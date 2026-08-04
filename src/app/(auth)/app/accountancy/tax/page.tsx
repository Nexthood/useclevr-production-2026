import { StatCard } from "@/components/ui/stat-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getBusinessProfileForCurrentTenant } from "@/lib/business/current-business-profile"
import { Landmark } from "lucide-react"

export const metadata = {
  title: "Accountancy Tax - UseClevr",
}

export default async function AccountancyTaxPage() {
  const businessProfile = await getBusinessProfileForCurrentTenant()
  const setup = businessProfile.setup
  const taxCountry = displayProfileValue(setup?.companyInfo.taxResidenceCountry)
  const industry = displayProfileValue(setup?.companyInfo.industry)

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle>Tax calculation tools</CardTitle>
        <CardDescription>Calculate and track VAT, corporate tax, and filing requirements.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <StatCard icon={Landmark} label="Tax region" value={taxCountry} />
          <StatCard icon={Landmark} label="Business activity" value={industry} />
        </div>
        <p className="text-sm text-muted-foreground">
          Tax calculations require a business location and industry. Complete your business profile to enable automated tax insights.
        </p>
      </CardContent>
    </Card>
  )
}

function displayProfileValue(value: string | null | undefined) {
  if (value === null || value === undefined) return "Not configured"
  const text = value.trim()
  return text.length > 0 ? text : "Not configured"
}
