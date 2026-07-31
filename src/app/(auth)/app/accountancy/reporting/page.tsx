import { StatCard } from "@/components/ui/stat-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth/auth"
import { displayBusinessProfileValue, getBusinessProfileContext } from "@/lib/business/business-profile-context"
import { getDb } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { count, eq, sum } from "drizzle-orm"
import { BarChart3, Calendar, DollarSign } from "lucide-react"

export const metadata = {
  title: "Accountancy Reporting - UseClevr",
}

async function getReportingMetrics(userId: string | null | undefined) {
  if (!userId) return { totalDatasets: 0, totalRows: 0, analysisReady: 0 }

  const db = getDb()
  if (!db) return { totalDatasets: 0, totalRows: 0, analysisReady: 0 }

  try {
    const [countResult, rowCountResult] = await Promise.all([
      db.select({ count: count() }).from(datasets).where(eq(datasets.userId, userId)),
      db
        .select({ total: sum(datasets.rowCount) })
        .from(datasets)
        .where(eq(datasets.userId, userId)),
    ])

    const totalDatasets = countResult[0]?.count ?? 0
    const totalRows = Number(rowCountResult[0]?.total ?? 0)

    return {
      totalDatasets,
      totalRows,
      analysisReady: totalDatasets,
    }
  } catch {
    return { totalDatasets: 0, totalRows: 0, analysisReady: 0 }
  }
}

export default async function AccountancyReportingPage() {
  const session = await auth()
  const userId = session?.user?.id
  const metrics = await getReportingMetrics(userId)
  const profileContext = await getBusinessProfileContext(userId)
  const reportingCurrency = displayBusinessProfileValue(profileContext.currency)

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle>Monthly reporting</CardTitle>
        <CardDescription>Automated financial reports generated from connected datasets.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <StatCard icon={BarChart3} label="Datasets" value={metrics.totalDatasets.toString()} variant="large" />
          <StatCard icon={DollarSign} label="Total rows" value={metrics.totalRows.toLocaleString()} variant="large" />
          <StatCard icon={Calendar} label="Ready for analysis" value={metrics.analysisReady.toString()} variant="large" />
          <StatCard icon={DollarSign} label="Profile currency" value={reportingCurrency} variant="large" />
        </div>
        <p className="text-sm text-muted-foreground">
          Reports are generated automatically when datasets have valid financial data. Visit the datasets page to upload profit/loss statements or accounting exports.
        </p>
      </CardContent>
    </Card>
  )
}
