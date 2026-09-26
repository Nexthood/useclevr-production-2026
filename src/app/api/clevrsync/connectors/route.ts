import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store";
import { debugError } from "@/lib/utils/debug";
import {
  clevrSyncAccessErrorPayload,
  requireClevrSyncAccess,
} from "@/services/clevrsync/access";
import {
  createClevrSyncConnector,
  isClevrSyncConnectorType,
  isConnectorTypeAvailable,
  listClevrSyncConnectors,
} from "@/services/clevrsync";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireBuiltinUserRecord(session.user.id);
    await requireClevrSyncAccess(session.user);
    const connectors = await listClevrSyncConnectors(session.user.id);
    return NextResponse.json({ connectors });
  } catch (error) {
    const accessError = clevrSyncAccessErrorPayload(error);
    if (accessError) {
      return NextResponse.json(accessError, { status: accessError.status });
    }
    debugError("[ClevrSync] Connector list failed:", error);
    return NextResponse.json({ error: "Unable to load data connections" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireBuiltinUserRecord(session.user.id);
    await requireClevrSyncAccess(session.user);
    const body = await request.json().catch(() => null);
    const type = body?.type;

    if (!isClevrSyncConnectorType(type)) {
      return NextResponse.json({ error: "Unsupported connector type" }, { status: 400 });
    }

    if (type === "google_sheets") {
      return NextResponse.json(
        { error: "Google Sheets must be connected through OAuth" },
        { status: 400 },
      );
    }

    if (type === "excel") {
      return NextResponse.json(
        { error: "Excel is not a ClevrSync connector. Upload local Excel files through the normal UseClevr upload." },
        { status: 400 },
      );
    }

    if (!isConnectorTypeAvailable(type)) {
      return NextResponse.json({ error: "Connector type is coming soon" }, { status: 400 });
    }

    const connector = await createClevrSyncConnector({
      userId: session.user.id,
      organizationId: typeof body?.organizationId === "string" ? body.organizationId : null,
      type,
      displayName: typeof body?.displayName === "string" ? body.displayName : null,
      sourceMeta: sanitizeSourceMeta(body?.sourceMeta),
    });

    return NextResponse.json({ connector }, { status: 201 });
  } catch (error) {
    const accessError = clevrSyncAccessErrorPayload(error);
    if (accessError) {
      return NextResponse.json(accessError, { status: accessError.status });
    }
    debugError("[ClevrSync] Connector create failed:", error);
    const message =
      error instanceof Error && error.message === "Database is not configured"
        ? error.message
        : "Unable to create data connection";
    const status = message === "Database is not configured" ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

function sanitizeSourceMeta(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const meta = value as Record<string, unknown>;
  return {
    fileName: typeof meta.fileName === "string" ? meta.fileName.slice(0, 255) : undefined,
    worksheet: typeof meta.worksheet === "string" ? meta.worksheet.slice(0, 255) : undefined,
  };
}
