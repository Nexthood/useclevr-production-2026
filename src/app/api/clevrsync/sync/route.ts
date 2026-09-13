import { NextResponse } from "next/server";

import { uploadCSV } from "@/app/actions/upload";
import { auth } from "@/lib/auth/auth";
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store";
import { uploadValidationErrorPayload } from "@/lib/upload/upload-security";
import { debugError } from "@/lib/utils/debug";
import {
  createClevrSyncRun,
  getOwnedClevrSyncConnector,
  parseExcelWorkbook,
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

    if (!connectorId) {
      return NextResponse.json({ error: "Connector is required" }, { status: 400 });
    }

    const connector = await getOwnedClevrSyncConnector(session.user.id, connectorId);
    if (!connector) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    const uploadFormData = new FormData();
    uploadFormData.set("file", file);
    uploadFormData.set("uploadSource", "clevrsync");
    uploadFormData.set("business_model", "generic");

    const uploadResult = await uploadCSV(uploadFormData, {
      user: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
      },
    });

    const run = await createClevrSyncRun({
      userId: session.user.id,
      connectorId: connector.id,
      preview,
      status: uploadResult.success ? "completed" : "failed",
      datasetId: uploadResult.datasetId ?? null,
      error: uploadResult.error ?? null,
    });

    const status = uploadResult.success ? 200 : 422;
    return NextResponse.json({ sync: run, upload: uploadResult }, { status });
  } catch (error) {
    debugError("[ClevrSync] Sync failed:", error);
    const payload = uploadValidationErrorPayload(error, "CLEVRSYNC_SYNC_FAILED");
    return NextResponse.json({ error: payload.message, code: payload.code }, { status: payload.status });
  }
}
