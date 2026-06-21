"use client"

import { CsvUpload } from "@/components/forms/csv-upload"
import { ProfitabilityUpload } from "@/components/forms/profitability-upload"
import { DashboardSubpageLayout } from "@/components/layout/dashboard-subpage-layout"
import { CheckCircle2, FileSpreadsheet, Gauge, Lock, TrendingUp, Upload } from "lucide-react"
import * as React from "react"

export default function UploadPage() {
  const [uploadMode, setUploadMode] = React.useState<"standard" | "profitability">("standard")
  
  const features = [
    { icon: Lock, text: "Secure data processing" },
    { icon: Gauge, text: "AI-powered analysis in seconds" },
    { icon: CheckCircle2, text: "Structured insights instantly" },
  ]

  const rightSidebar = (
    <aside className="hidden w-80 shrink-0 border-l border-border bg-card lg:block">
      <div className="flex h-full flex-col overflow-y-auto p-4">
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Upload guide</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Add a CSV file and prepare it for analysis. Use standard upload for general datasets or profitability analysis for financial statements.
            </p>
          </div>
        </div>
      </div>
    </aside>
  )

  return (
    <DashboardSubpageLayout
      title="Upload Dataset"
      description="Add a CSV file and prepare it for analysis."
      breadcrumbs={[
        { label: "Dashboard", href: "/app" },
        { label: "Upload" },
      ]}
      icon={Upload}
      rightSidebar={rightSidebar}
    >
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl min-w-0 px-4 pt-8 sm:px-6">
          {/* Mode Selector */}
          <div className="mt-10 grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-3 shadow-sm sm:grid-cols-2">
            <button
              onClick={() => setUploadMode("standard")}
              className={`flex min-w-0 flex-col items-start gap-1.5 rounded-lg border px-4 py-3 text-left text-sm font-semibold transition-all ${
                uploadMode === "standard"
                  ? "border-primary/60 bg-primary/10 text-foreground shadow-sm"
                  : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted"
              }`}
            >
              <span className="whitespace-nowrap">Standard Upload</span>
              <span className="text-xs font-normal text-muted-foreground">Upload a general CSV dataset.</span>
            </button>
            <button
              onClick={() => setUploadMode("profitability")}
              className={`flex min-w-0 flex-col items-start gap-1.5 rounded-lg border px-4 py-3 text-left text-sm font-semibold transition-all ${
                uploadMode === "profitability"
                  ? "border-primary/60 bg-primary/10 text-foreground shadow-sm"
                  : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted"
              }`}
            >
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <TrendingUp className="h-4 w-4" />
                Profitability Analysis
              </span>
              <span className="text-xs font-normal text-muted-foreground">Review revenue and expense files.</span>
            </button>
          </div>
        </div>
        {/* Use wide container for profitability result, narrow for upload */}
        {uploadMode === "profitability" ? (
          <div className="min-w-0 px-4 pb-6 pt-4 sm:px-6">
            <ProfitabilityUpload />
          </div>
        ) : (
          <div className="mx-auto w-full max-w-xl min-w-0 space-y-6 px-4 py-8 sm:px-6">
            {/* Hero section */}
            <div className="text-center space-y-3">
              {/* Premium icon */}
              <div className="relative inline-block">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent mx-auto flex items-center justify-center border border-primary/20">
                  <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                    <FileSpreadsheet className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>
              
              {/* Title */}
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-foreground tracking-tight">
                  Upload your dataset
                </h2>
                <p className="text-sm text-muted-foreground">
                  Drop your CSV file for instant AI analysis
                </p>
              </div>
            </div>

            {/* Upload component */}
            <CsvUpload />

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <feature.icon className="h-3.5 w-3.5 text-primary" />
                  <span>{feature.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </DashboardSubpageLayout>
  )
}
