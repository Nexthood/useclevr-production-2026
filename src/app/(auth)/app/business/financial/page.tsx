import { StatCard } from "@/components/ui/stat-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth/auth"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { BadgeDollarSign, Globe2 } from "lucide-react"

export const metadata = {
  title: "Business Financial Settings - UseClevr",
}

export default async function BusinessFinancialPage() {
  const session = await auth()
  const db = getDb()
  const profile = session?.user?.id && db
    ? await db.query.profiles.findFirst({
        where: eq(profiles.userId, session.user.id),
        columns: { preferredCurrency: true, numberFormat: true },
      })
    : null

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle>Financial settings</CardTitle>
        <CardDescription>Review currency and number formatting before report generation.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          <StatCard icon={BadgeDollarSign} label="Currency" value={profile?.preferredCurrency || "EUR"} />
          <StatCard icon={Globe2} label="Number format" value={profile?.numberFormat || "Auto"} />
        </div>
      </CardContent>
    </Card>
  )
}


