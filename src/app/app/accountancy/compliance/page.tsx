import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { getPrimaryBusinessDetails } from "@/lib/business/business-store"
import { CheckCircle2, FileText, Shield } from "lucide-react"
import type React from "react"

export const metadata = {
  title: "Accountancy Compliance - UseClevr",
}

export default async function AccountancyCompliancePage() {
  const session = await auth()
  const details = await getPrimaryBusinessDetails(session?.user?.id)

  const profileComplete = !!(details.businessName && details.industry && details.location)
  const locationComplete = !!details.location
  const industryComplete = !!details.industry

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle>Compliance checklist</CardTitle>
        <CardDescription>Track requirements before generating tax reports and financial statements.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <ComplianceItem
            icon={CheckCircle2}
            label="Business profile"
            complete={profileComplete}
            help="Complete business name, industry, and location in business settings."
          />
          <ComplianceItem
            icon={Shield}
            label="Operating location"
            complete={locationComplete}
            help="Add the primary operating location for regional tax assumptions."
          />
          <ComplianceItem
            icon={FileText}
            label="Industry context"
            complete={industryComplete}
            help="Specify the industry to enable accurate tax categorization."
          />
        </div>
      </CardContent>
    </Card>
  )
}

function ComplianceItem({
  icon: Icon,
  label,
  complete,
  help,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  complete: boolean
  help: string
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-border bg-background p-4">
      <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${complete ? "text-green-500" : "text-amber-500"}`} />
      <div>
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">
          {complete ? "Complete" : help}
        </p>
      </div>
    </div>
  )
}