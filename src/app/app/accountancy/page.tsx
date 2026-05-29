import { AppPageHeader } from "@/components/layout/app-page-header"
import { Card } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { businesses, datasets } from "@/lib/db/schema"
import { count, eq } from "drizzle-orm"
import { DollarSign, FileText, MapPin } from "lucide-react"
import Link from "next/link"

export const metadata = {
  title: "Accountancy - UseClevr",
}

export default async function AccountancyPage() {
  const session = await auth()
  const userId = session?.user?.id

  let activeDatasets = 0
  let totalBusinesses = 0

  if (userId) {
    const db = getDb()
    if (db) {
      try {
        const [countResult] = await db
          .select({ count: count() })
          .from(datasets)
          .where(eq(datasets.userId, userId))

        const [businessCount] = await db
          .select({ count: count() })
          .from(businesses)
          .where(eq(businesses.userId, userId))

        activeDatasets = (countResult?.count ?? 0) as number
        totalBusinesses = (businessCount?.count ?? 0) as number
      } catch {
        // Keep defaults
      }
    }
  }

  return (
    <>
      <AppPageHeader
        title="Accountancy"
        description="Financial records, tax calculations, and compliance tools."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Accountancy" },
        ]}
      />

      <div className="space-y-6 pt-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5 bg-card border-border">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-800 dark:text-green-100" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalBusinesses}</p>
                <p className="text-sm text-muted-foreground">Business profiles</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 bg-card border-border">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-blue-800 dark:text-blue-100" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{activeDatasets}</p>
                <p className="text-sm text-muted-foreground">Connected datasets</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 bg-card border-border">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <MapPin className="h-6 w-6 text-purple-800 dark:text-purple-100" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">75%</p>
                <p className="text-sm text-muted-foreground">Avg completion</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-6 bg-card border-border">
            <h2 className="text-lg font-semibold text-foreground mb-4">Financial Overview</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Connect financial data to enable automated tax calculations and reporting.
            </p>
            <div className="space-y-2">
              <Link
                href="/app/accountancy/reporting"
                className="block text-sm text-primary hover:underline"
              >
                Monthly reporting dashboard
              </Link>
              <Link
                href="/app/accountancy/tax"
                className="block text-sm text-primary hover:underline"
              >
                Tax calculation tools
              </Link>
              <Link
                href="/app/accountancy/compliance"
                className="block text-sm text-primary hover:underline"
              >
                Compliance checklist
              </Link>
            </div>
          </Card>

          <Card className="p-6 bg-card border-border">
            <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Upload profit/loss statements or import accounting data for automated insights.
              </p>
              <Link
                href="/app/upload"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                Upload financial data
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}