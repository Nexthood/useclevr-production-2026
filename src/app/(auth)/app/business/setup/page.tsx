import { CompanySetupWizard } from "@/components/business/company-setup-wizard"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Company Setup",
  description: "Configure your company details for accurate business analysis.",
}

export default function CompanySetupPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <CompanySetupWizard />
    </div>
  )
}
