import { auth } from "@/lib/auth/auth";
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store";
import {
  AccountancyUploadError,
  normalizeAccountancyDatasetType,
  normalizeAccountancyUploadType,
  processAccountancyUpload,
} from "@/lib/accountancy/upload-processing";
import { debugError } from "@/lib/utils/debug";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return structuredError("validation", "UNAUTHORIZED", "Please sign in before uploading a file.", 401, false);
    }

    await requireBuiltinUserRecord(userId);

    const formData = await request.formData();
    const file = formData.get("file");
    const uploadType = normalizeAccountancyUploadType(formData.get("uploadType") || formData.get("type"));
    const datasetType = normalizeAccountancyDatasetType(formData.get("dataset_type") || formData.get("uploadMode"));

    if (!(file instanceof File)) {
      return structuredError("validation", "MISSING_FILE", "Upload request is missing a file.", 400, false);
    }

    if (!uploadType) {
      return structuredError("validation", "INVALID_UPLOAD_TYPE", "Select a valid Accountancy upload type.", 400, false);
    }

    if (!datasetType) {
      return structuredError("validation", "INVALID_DATASET_TYPE", "Select Accountancy or Pre-bookkeeping before uploading.", 400, false);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await processAccountancyUpload({
      buffer,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      userId,
      datasetType,
      uploadType,
    });

    revalidatePath("/app/datasets");
    revalidatePath("/app/accountancy");
    revalidatePath("/app/prebookkeeping");

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AccountancyUploadError) {
      return structuredError(error.stage, error.code, error.message, error.status, error.retryable);
    }

    debugError("[ACCOUNTANCY-UPLOAD] unexpected route failure", error);
    return structuredError(
      "validation",
      "UNEXPECTED_ACCOUNTANCY_UPLOAD_ERROR",
      "Unexpected upload failure. Check server logs for the detailed error.",
      500,
      false,
    );
  }
}

function structuredError(
  stage: "validation" | "storage" | "parsing" | "database" | "extraction",
  code: string,
  message: string,
  status: number,
  retryable: boolean,
) {
  return NextResponse.json(
    {
      ok: false,
      success: false,
      stage,
      step: stage,
      code,
      error: message,
      message,
      retryable,
    },
    { status },
  );
}
