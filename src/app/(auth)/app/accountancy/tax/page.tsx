import { StatCard } from "@/components/ui/stat-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth/auth"
import { getPrimaryBusinessDetails } from "@/lib/business/business-store"
import { Landmark } from "lucide-react"

export const metadata = {
  title: "Accountancy Tax - UseClevr",
}

export default async function AccountancyTaxPage() {
  const session = await auth()
  const details = await getPrimaryBusinessDetails(session?.user?.id)
  const safeDetails = details ?? {}

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle>Tax calculation tools</CardTitle>
        <CardDescription>Calculate and track VAT, corporate tax, and filing requirements.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <StatCard icon={Landmark} label="Tax region" value={safeDetails.location || "Not configured - add location in business profile"} />
          <StatCard icon={Landmark} label="Business activity" value={safeDetails.industry || "Not configured - add industry in business profile"} />
        </div>
        <p className="text-sm text-muted-foreground">
          Tax calculations require a business location and industry. Complete your business profile to enable automated tax insights.
        </p>
      </CardContent>
    </Card>
  )
}

