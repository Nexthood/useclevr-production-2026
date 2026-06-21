import { BusinessProfileQuestionWizard } from "@/components/business/business-profile-question-wizard"
import { DashboardContent } from "@/components/layout/dashboard-subpage-layout"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Company Setup",
  description: "Configure your company details for accurate business analysis.",
}

export default function CompanySetupPage() {
  return (
    <DashboardContent>
      <div className="mx-auto max-w-2xl">
        <BusinessProfileQuestionWizard />
      </div>
    </DashboardContent>
  )
}
