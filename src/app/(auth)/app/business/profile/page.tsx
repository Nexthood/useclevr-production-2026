import { BusinessProfileForm } from "@/components/business/business-profile-form"
import { DashboardContent } from "@/components/layout/dashboard-subpage-layout"
import { PageActionRow } from "@/components/ui/page-action-row"
import Link from "next/link"

export const metadata = {
  title: "Business Profile - UseClevr",
}

export default function BusinessProfilePage() {
  return (
    <DashboardContent className="space-y-5">
      <PageActionRow description="Save the company details that power reports, support context, and setup progress.">
        <Link
          href="/app/business"
          className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
        >
          Back to businesses
        </Link>
      </PageActionRow>
      <BusinessProfileForm />
    </DashboardContent>
  )
}
