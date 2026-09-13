import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store";
import { uploadValidationErrorPayload } from "@/lib/upload/upload-security";
import { debugError } from "@/lib/utils/debug";
import {
  getOwnedClevrSyncConnector,
  parseExcelWorkbook,
  toDatasetPayload,
} from "@/services/clevrsync";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireBuiltinUserRecord(session.user.id);
    const formData = await request.formData();
    const connectorId = String(formData.get("connectorId") || "").trim();
    const file = formData.get("file");

    if (connectorId) {
      const connector = await getOwnedClevrSyncConnector(session.user.id, connectorId);
      if (!connector) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "XLSX file is required" }, { status: 400 });
    }

    const preview = parseExcelWorkbook({
      fileBuffer: await file.arrayBuffer(),
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
    const dataset = toDatasetPayload(preview);

    return NextResponse.json({
      preview,
      dataset: {
        name: dataset.name,
        fileName: dataset.fileName,
        columns: dataset.columns,
        rowCount: preview.rowCount,
        columnTypes: dataset.columnTypes,
        datasetType: dataset.datasetType,
        source: dataset.source,
      },
    });
  } catch (error) {
    debugError("[ClevrSync] Preview failed:", error);
    const payload = uploadValidationErrorPayload(error, "CLEVRSYNC_PREVIEW_FAILED");
    return NextResponse.json({ error: payload.message, code: payload.code }, { status: payload.status });
  }
}
