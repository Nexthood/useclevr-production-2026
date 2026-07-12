import { detectAccuracyCapabilities } from "@/lib/accuracy/capabilities"
import { requireSuperAdmin } from "@/lib/auth/require-session"
import { db } from "@/lib/db"
import { accuracyIngestionJobs, retrievalDocuments } from "@/lib/db/schema"
import { debugError } from "@/lib/utils/debug"
import { count, desc } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET() {
  const auth = await requireSuperAdmin()
  if (!auth.success) return auth.error

  try {
    const [capabilities, [documentCount], recentJobs] = await Promise.all([
      detectAccuracyCapabilities({ force: true }),
      db.select({ count: count() }).from(retrievalDocuments),
      db.query.accuracyIngestionJobs.findMany({
        columns: {
          id: true,
          userId: true,
          datasetId: true,
          datasetType: true,
          status: true,
          documentCount: true,
          embeddedCount: true,
          skippedCount: true,
          errorMessage: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [desc(accuracyIngestionJobs.updatedAt)],
        limit: 10,
      }),
    ])

    return NextResponse.json({
      ok: true,
      accuracyEngine: {
        mode: capabilities.mode,
        capabilities: {
          lakebaseVector: capabilities.lakebaseVector,
          lakebaseText: capabilities.lakebaseText,
          pgvector: capabilities.pgvector,
          fullTextSearch: capabilities.fullTextSearch,
        },
        checkedAt: capabilities.checkedAt,
        retrievalDocuments: documentCount?.count || 0,
        recentJobs,
      },
    })
  } catch (error) {
    debugError("[ACCURACY] Admin status failed", error)
    return NextResponse.json({ ok: false, error: "Accuracy Engine status failed." }, { status: 500 })
  }
}
