import { StatCard } from "@/components/ui/stat-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth/auth"
import { getCompanySetup } from "@/lib/business/company-setup-store"
import { getPrimaryBusinessDetails } from "@/lib/business/business-store"
import { Landmark } from "lucide-react"

export const metadata = {
  title: "Accountancy Tax - UseClevr",
}

export default async function AccountancyTaxPage() {
  const session = await auth()
  const setup = session?.user?.id ? await getCompanySetup(session.user.id) : null
  const details = await getPrimaryBusinessDetails(session?.user?.id)
  const safeDetails = details ?? {}
  const taxCountry = displayProfileValue(setup?.companyInfo.taxResidenceCountry)

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle>Tax calculation tools</CardTitle>
        <CardDescription>Calculate and track VAT, corporate tax, and filing requirements.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <StatCard icon={Landmark} label="Tax region" value={taxCountry} />
          <StatCard icon={Landmark} label="Business activity" value={safeDetails.industry || "Not configured - add industry in business profile"} />
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
