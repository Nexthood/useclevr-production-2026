import { BUILTIN_SUPER_ADMIN_USER } from "@/lib/auth/builtin-users"
import { getDb } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import type { PayloadRequest } from "payload"
import { z, type ZodRawShape } from "zod/v3"

const datasetIdInput = z.object({
  datasetId: z.string().min(1).describe("The dataset ID returned by listDashboardDatasets."),
})

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value),
      },
    ],
  }
}

export async function listDemoDashboardDatasets() {
  const db = getDb()
  if (!db) {
    throw new Error("Dashboard database is unavailable.")
  }

  const rows = await db.query.datasets.findMany({
    where: eq(datasets.userId, BUILTIN_SUPER_ADMIN_USER.id),
    columns: {
      id: true,
      name: true,
      fileName: true,
      rowCount: true,
      columnCount: true,
      columns: true,
      analysisStatus: true,
      createdAt: true,
    },
    orderBy: (fields, { desc }) => [desc(fields.createdAt)],
  })

  return {
    account: "UseClevr test account",
    datasets: rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
  }
}

export async function getDemoDashboardDatasetInsights(datasetId: string) {
  const db = getDb()
  if (!db) {
    throw new Error("Dashboard database is unavailable.")
  }

  const row = await db.query.datasets.findFirst({
    where: and(eq(datasets.id, datasetId), eq(datasets.userId, BUILTIN_SUPER_ADMIN_USER.id)),
    columns: {
      id: true,
      name: true,
      rowCount: true,
      columnCount: true,
      columns: true,
      columnTypes: true,
      analysisStatus: true,
      analysisMessage: true,
      invalidRowCount: true,
      missingValueCounts: true,
      precomputedMetrics: true,
      detectedColumns: true,
      aiInsights: true,
      updatedAt: true,
    },
  })

  if (!row) {
    throw new Error("Dataset not found in the UseClevr test account.")
  }

  return {
    ...row,
    updatedAt: row.updatedAt.toISOString(),
  }
}

type PayloadMcpTool = {
  name: string
  description: string
  parameters: ZodRawShape
  handler: (
    args: Record<string, unknown>,
    req: PayloadRequest,
    extra: unknown,
  ) => Promise<ReturnType<typeof textResult>>
}

export const dashboardMcpTools: PayloadMcpTool[] = [
  {
    name: "listDashboardDatasets",
    description:
      "Lists datasets available in the locked UseClevr test account. Returns metadata only and never returns uploaded rows.",
    parameters: z.object({}).shape,
    handler: async () => textResult(await listDemoDashboardDatasets()),
  },
  {
    name: "getDashboardDatasetInsights",
    description:
      "Returns stored KPIs, chart summaries, rankings, risks, opportunities, and AI insights for one dataset in the locked UseClevr test account. Never returns uploaded rows.",
    parameters: datasetIdInput.shape,
    handler: async (args: Record<string, unknown>) => {
      const input = datasetIdInput.parse(args)
      return textResult(await getDemoDashboardDatasetInsights(input.datasetId))
    },
  },
]
