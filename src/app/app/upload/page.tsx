"use client"

import * as React from "react"
import { CheckCircle2, FileSpreadsheet, Gauge, Lock, TrendingUp } from "lucide-react"
import { CsvUpload } from "@/components/csv-upload"
import { ProfitabilityUpload } from "@/components/profitability-upload"
import { AppPageHeader } from "@/components/layout/app-page-header"

export default function UploadPage() {
  const [uploadMode, setUploadMode] = React.useState<"standard" | "profitability">("standard")
  
  const features = [
    { icon: Lock, text: "Secure data processing" },
    { icon: Gauge, text: "AI-powered analysis in seconds" },
    { icon: CheckCircle2, text: "Structured insights instantly" },
  ]

  return (
    <div className="min-h-screen bg-background">
      <AppPageHeader
        title="Upload Dataset"
        description="Add a CSV file and prepare it for analysis."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Datasets", href: "/app/datasets" },
          { label: "Upload" },
        ]}
      />

      <main className="flex-1">
        {/* Use wide container for profitability result, narrow for upload */}
        {uploadMode === "profitability" ? (
          <div className="flex-1 overflow-y-auto p-6">
            <ProfitabilityUpload />
          </div>
        ) : (
          <div className="max-w-xl mx-auto space-y-6 py-8 px-6">
            {/* Mode Selector */}
            <div className="flex gap-2 p-1 bg-muted/50 rounded-lg">
              <button
                onClick={() => setUploadMode("standard")}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  uploadMode === "standard" 
                    ? "bg-background shadow-sm text-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Standard Upload
              </button>
              <button
                onClick={() => setUploadMode("profitability")}
                className="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <TrendingUp className="h-4 w-4" />
                Profitability Analysis
              </button>
            </div>

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
    </div>
  )
}
