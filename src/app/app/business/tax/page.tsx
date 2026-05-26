import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { Landmark } from "lucide-react"
import type React from "react"

export const metadata = {
  title: "Business Tax - UseClevr",
}

export default async function BusinessTaxPage() {
  const session = await auth()
  const db = getDb()
  const profile = session?.user?.id && db
    ? await db.query.profiles.findFirst({
        where: eq(profiles.userId, session.user.id),
        columns: { location: true, industry: true },
      })
    : null

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle>Tax & VAT</CardTitle>
        <CardDescription>Review the location and industry context used before tax-sensitive analysis.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          <ContextItem icon={Landmark} label="Tax region" value={profile?.location || "Needs location"} />
          <ContextItem icon={Landmark} label="Business activity" value={profile?.industry || "Needs industry"} />
        </div>
      </CardContent>
    </Card>
  )
}

function ContextItem({
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
      <p className="mt-2 text-sm text-muted-foreground">{value}</p>
    </div>
  )
}
