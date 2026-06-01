import { StatCard } from "@/components/ui/stat-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth/auth"
import { getPrimaryBusinessDetails } from "@/lib/business/business-store"
import { Landmark } from "lucide-react"

export const metadata = {
  title: "Business Tax - UseClevr",
}

export default async function BusinessTaxPage() {
  const session = await auth()
  const details = await getPrimaryBusinessDetails(session?.user?.id)
  const safe = details ?? {}

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle>Tax & VAT</CardTitle>
        <CardDescription>Review the location and industry context used before tax-sensitive analysis.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          <StatCard icon={Landmark} label="Tax region" value={safe.location || "Needs location"} />
          <StatCard icon={Landmark} label="Business activity" value={safe.industry || "Needs industry"} />
        </div>
      </CardContent>
    </Card>
  )
}


