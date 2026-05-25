import { Card } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { count, eq } from "drizzle-orm"
import { BarChart3, Database, FileText, TrendingUp } from "lucide-react"
import Link from "next/link"

export const metadata = {
  title: "Dashboard - UseClevr",
  description: "Analytics dashboard",
}

async function getStats(userId: string | null) {
  if (!userId) {
    return { datasets: 0, analyses: 0, reports: 0 }
  }

  try {
    const [datasetCount] = await Promise.all([
      db.select({ value: count() }).from(datasets).where(eq(datasets.userId, userId)),
    ])

    return {
      datasets: datasetCount[0]?.value || 0,
      analyses: datasetCount[0]?.value || 0,
      reports: 0,
    }
  } catch {
    return { datasets: 0, analyses: 0, reports: 0 }
  }
}

export default async function AppDashboard() {
  const session = await auth()
  const userId = session?.user?.id ?? null
  const stats = await getStats(userId)

  return (
    <div className="min-h-screen bg-background">
      <div className="px-5 py-5">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Overview of your analytics workspace</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/app/datasets">
              <Card className="p-5 bg-card border-border hover:border-primary/40 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <Database className="h-6 w-6 text-cyan-800 dark:text-cyan-100" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.datasets}</p>
                    <p className="text-sm text-muted-foreground">Datasets</p>
                  </div>
                </div>
              </Card>
            </Link>

            <Link href="/app/downloads">
              <Card className="p-5 bg-card border-border hover:border-primary/40 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-primary dark:text-cyan-100" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.analyses}</p>
                    <p className="text-sm text-muted-foreground">Analyses</p>
                  </div>
                </div>
              </Card>
            </Link>

            <Link href="/app/downloads">
              <Card className="p-5 bg-card border-border hover:border-primary/40 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-emerald-800 dark:text-emerald-100" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.reports}</p>
                    <p className="text-sm text-muted-foreground">Reports</p>
                  </div>
                </div>
              </Card>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5 bg-card border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-amber-800 dark:text-amber-100" />
                </div>
                <h2 className="font-semibold text-foreground">Getting started</h2>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Upload your first dataset to begin analysis</li>
                <li>• Configure business profile for better insights</li>
                <li>• Enable Hybrid AI for advanced processing</li>
              </ul>
            </Card>

            <Card className="p-5 bg-card border-border">
              <h2 className="font-semibold text-foreground mb-4">Quick actions</h2>
              <div className="space-y-2">
                <Link href="/app/datasets" className="block text-sm text-primary hover:underline">
                  Upload new dataset →
                </Link>
                <Link href="/app/settings/business" className="block text-sm text-primary hover:underline">
                  Complete business profile →
                </Link>
                <Link href="/app/settings/subscription" className="block text-sm text-primary hover:underline">
                  Upgrade plan →
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}