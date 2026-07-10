import { auth } from "@/lib/auth/auth"
import { parseCSVStreaming } from "@/lib/data/csvLoader"
import { getDb } from "@/lib/db"
import { datasetRows, datasets } from "@/lib/db/schema"
import { debugError } from "@/lib/utils/debug"
import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"

const SIMPLE_PARSE_ROW_LIMIT = 1000
const SIMPLE_ROW_INSERT_LIMIT = 1000

function jsonError(
  status: number,
  stage: string,
  message: string,
  retryable = false,
  extra: Record<string, unknown> = {},
) {
  return NextResponse.json({
    ok: false,
    success: false,
    stage,
    step: stage,
    message,
    error: message,
    retryable,
    ...extra,
  }, { status })
}

function serializeDatasetCreateError(error: unknown) {
  if (error instanceof Error) {
    const cause = "cause" in error ? (error as Error & { cause?: unknown }).cause : undefined
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      cause: cause instanceof Error
        ? { name: cause.name, message: cause.message }
        : cause ? String(cause) : undefined,
    }
  }

  return { message: String(error) }
}

function isCsvOrExcel(file: File) {
  const fileName = file.name.toLowerCase()
  return (
    fileName.endsWith(".csv") ||
    fileName.endsWith(".xlsx") ||
    fileName.endsWith(".xls") ||
    file.type.includes("csv") ||
    file.type.includes("spreadsheet") ||
    file.type.includes("excel") ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel"
  )
}

export async function POST(request: Request) {
  let formData: FormData

  try {
    formData = await request.formData()
  } catch (error) {
    debugError("[SIMPLE_UPLOAD] Could not read form data:", error)
    return jsonError(400, "formdata_validated", "Upload request could not be read.")
  }

  const receivedFields = Array.from(formData.keys())
  const file = formData.get("file")
  const datasetTypeValue = formData.get("dataset_type")
  const datasetType = typeof datasetTypeValue === "string" ? datasetTypeValue.trim().toLowerCase() : ""
  const missingFields: string[] = []

  if (!(file instanceof File)) missingFields.push("file")
  if (!datasetType) missingFields.push("dataset_type")

  if (missingFields.length > 0) {
    return jsonError(400, "formdata_validated", `Upload request is missing required field${missingFields.length === 1 ? "" : "s"}: ${missingFields.join(", ")}.`, false, {
      missingFields,
      receivedFields,
    })
  }

  if (datasetType !== "standard") {
    return jsonError(400, "formdata_validated", "Simple upload only accepts dataset_type=standard.", false, {
      receivedFields,
    })
  }

  const uploadFile = file as File

  let session
  try {
    session = await auth()
  } catch (error) {
    debugError("[SIMPLE_UPLOAD] Auth check failed:", error)
    return jsonError(401, "auth_checked", "Please sign in before uploading a dataset.", true)
  }

  const userId = session?.user?.id
  if (!userId) {
    return jsonError(401, "auth_checked", "Please sign in before uploading a dataset.", true)
  }

  if (!isCsvOrExcel(uploadFile)) {
    return jsonError(422, "file_validated", "File must be a CSV or Excel file (.csv, .xlsx, .xls).")
  }

  let parsed
  try {
    parsed = await parseCSVStreaming(uploadFile, SIMPLE_PARSE_ROW_LIMIT)
  } catch (error) {
    debugError("[SIMPLE_UPLOAD] File parse failed:", error)
    return jsonError(422, "file_parsed", "Unable to parse this CSV or Excel file. Check that it has a header row and at least one data row.")
  }

  if (parsed.columns.length === 0) {
    return jsonError(422, "file_parsed", "File contains no columns or has an invalid header row.")
  }

  const db = getDb()
  if (!db) {
    return jsonError(503, "dataset_created", "Database is unavailable. Please try again.", true)
  }

  const datasetId = `ds_${Date.now()}_${uuidv4().slice(0, 8)}`
  const now = new Date()
  const parsedRows = (parsed.previewRows as Record<string, unknown>[]).slice(0, SIMPLE_ROW_INSERT_LIMIT)
  const datasetName = uploadFile.name.replace(/\.(csv|xlsx|xls)$/i, "")
  const datasetPayload = {
    id: datasetId,
    userId,
    name: datasetName || uploadFile.name,
    fileName: uploadFile.name,
    fileSize: uploadFile.size,
    rowCount: parsed.rowCount,
    columnCount: parsed.columns.length,
    columns: parsed.columns,
    data: parsedRows.slice(0, 100),
    columnTypes: {},
    precomputedMetrics: parsed.aggregatedMetrics,
    datasetType: "standard",
    status: "ready",
    analysis: {
      datasetCategory: "standard",
      datasetType: "standard",
      uploadSource: "simple_standard_upload",
    },
    createdAt: now,
    updatedAt: now,
  }

  try {
    await db.insert(datasets).values(datasetPayload)
  } catch (error) {
    const serializedError = serializeDatasetCreateError(error)
    console.error("[SIMPLE_UPLOAD] Dataset insert failed", {
      model: "Dataset",
      error,
      payload: datasetPayload,
    })
    debugError("[SIMPLE_UPLOAD] Dataset insert failed:", error)
    return jsonError(500, "dataset_create", "Could not create the dataset. Please try again.", true, {
      model: "Dataset",
      error: process.env.NODE_ENV === "development" ? serializedError : "Dataset create failed.",
      payload: process.env.NODE_ENV === "development" ? datasetPayload : undefined,
    })
  }

  if (parsedRows.length > 0) {
    try {
      const rowValues = parsedRows.map((row, index) => ({
        id: `${datasetId}-row-${index}`,
        datasetId,
        rowIndex: index,
        data: row,
      }))
      await db.insert(datasetRows).values(rowValues)
    } catch (error) {
      debugError("[SIMPLE_UPLOAD] Row insert failed:", error)
    }
  }

  return NextResponse.json({
    ok: true,
    success: true,
    stage: "response_sent",
    datasetId,
    dataset_type: "standard",
    redirectTo: "/app/datasets",
    message: "Dataset uploaded successfully. AI analysis can be started separately.",
    fileName: uploadFile.name,
    preview: {
      headers: parsed.columns,
      rows: parsedRows.slice(0, 5),
    },
  })
}
