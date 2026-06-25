import { PublicFooter } from "@/components/layout/public-footer"
import { PublicHeader } from "@/components/layout/public-header"
import { SampleReportExperience } from "@/components/public/sample-report-experience"

export const metadata = {
  title: "Sample AI Business Report - UseClevr",
  description: "Explore an interactive sample AI business intelligence report generated from realistic demo business data.",
}

export default function SampleReportPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      <PublicHeader />
      <main className="flex-1">
        <SampleReportExperience />
      </main>
      <PublicFooter />
    </div>
  )
}
