import { StatCard } from "@/components/ui/stat-card"
import { DashboardContent } from "@/components/layout/dashboard-subpage-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getBusinessProfileForCurrentTenant } from "@/lib/business/current-business-profile"
import { Landmark } from "lucide-react"

export const metadata = {
  title: "Business Tax - UseClevr",
}

export default async function BusinessTaxPage() {
  const businessProfile = await getBusinessProfileForCurrentTenant()
  const setup = businessProfile.setup

  return (
    <DashboardContent>
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Tax & VAT</CardTitle>
          <CardDescription>Review the location and industry context used before tax-sensitive analysis.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <StatCard icon={Landmark} label="Tax region" value={displayProfileValue(setup?.companyInfo.taxResidenceCountry)} />
            <StatCard icon={Landmark} label="Business activity" value={displayProfileValue(setup?.companyInfo.industry)} />
          </div>
        </CardContent>
      </Card>
    </DashboardContent>
  )
}

function displayProfileValue(value: string | null | undefined) {
  if (value === null || value === undefined) return "Not configured"
  const text = value.trim()
  return text.length > 0 ? text : "Not configured"
}
