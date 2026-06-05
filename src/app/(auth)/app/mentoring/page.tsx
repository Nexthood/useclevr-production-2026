import { AppPageHeader } from "@/components/layout/app-page-header"
import { auth } from "@/lib/auth/auth"
import { GraduationCap } from "lucide-react"
import type { Metadata } from "next"
import { MentoringClient } from "./mentoring-client"

export const metadata: Metadata = {
  title: "Business Mentoring",
}

export default async function MentoringPage() {
  const _session = await auth()

  return (
    <div className="flex-1 bg-background">
      <AppPageHeader
        title="Business Mentoring"
        description="Book expert sessions and review your mentoring history."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Mentoring" },
        ]}
        icon={GraduationCap}
      />

      <main className="px-5 py-5">
        <MentoringClient />
      </main>
    </div>
  )
}
