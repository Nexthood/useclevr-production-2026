import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { count, eq, sum } from "drizzle-orm"
import { BarChart3, Calendar, DollarSign } from "lucide-react"
import type React from "react"

export const metadata = {
  title: "Accountancy Reporting - UseClevr",
}

async function getReportingMetrics(userId: string | null | undefined) {
  if (!userId) return { totalDatasets: 0, totalRevenue: 0, analysisReady: 0 }

  const db = getDb()
  if (!db) return { totalDatasets: 0, totalRevenue: 0, analysisReady: 0 }

  try {
    const [countResult, revenueResult] = await Promise.all([
      db.select({ count: count() }).from(datasets).where(eq(datasets.userId, userId)),
      db
        .select({ total: sum(datasets.rowCount) })
        .from(datasets)
        .where(eq(datasets.userId, userId)),
    ])

    const totalDatasets = countResult[0]?.count ?? 0
    const totalRows = Number(revenueResult[0]?.total ?? 0)

    return {
      totalDatasets,
      totalRevenue: totalRows,
      analysisReady: totalDatasets,
    }
  } catch {
    return { totalDatasets: 0, totalRevenue: 0, analysisReady: 0 }
  }
}

export default async function AccountancyReportingPage() {
  const session = await auth()
  const userId = session?.user?.id
  const metrics = await getReportingMetrics(userId)

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle>Monthly reporting</CardTitle>
        <CardDescription>Automated financial reports generated from connected datasets.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <ReportMetric icon={BarChart3} label="Datasets" value={metrics.totalDatasets.toString()} />
          <ReportMetric icon={DollarSign} label="Total rows" value={metrics.totalRevenue.toLocaleString()} />
          <ReportMetric icon={Calendar} label="Ready for analysis" value={metrics.analysisReady.toString()} />
        </div>
        <p className="text-sm text-muted-foreground">
          Reports are generated automatically when datasets have valid financial data. Visit the datasets page to upload profit/loss statements or accounting exports.
        </p>
      </CardContent>
    </Card>
  )
}

function ReportMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold text-primary">{value}</p>
    </div>
  )
}