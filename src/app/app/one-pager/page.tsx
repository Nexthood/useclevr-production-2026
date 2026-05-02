"use client"

import { BusinessOnePager } from "@/components/business-one-pager"
import { useSearchParams } from "next/navigation"

interface PageProps {
  searchParams?: Record<string, string | string[] | undefined>
}

export default function OnePagerPage(_props: PageProps) {
  // This page expects to be navigated to from the analyzer context; however, we keep it resilient
  // Minimal dataset context can be passed via query if needed; otherwise component guards apply.
  const params = useSearchParams()
  const datasetName = (params.get("name") || "Business One-Pager")

  // BusinessOnePager already encapsulates form inputs, capabilities gating, preview and PDF export.
  // We render it full-width with a generous canvas wrapper for a page experience instead of a modal.
  return (
    <div className="min-h-screen">
      <main className="p-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-foreground">Business One-Pager</h1>
            <p className="text-sm text-muted-foreground">Compose a professional one-pager using validated metrics and your business context</p>
          </div>
          {/* Render One-Pager inline as a full page (no modal) */}
          <BusinessOnePager 
            analysis={undefined as any}
            datasetName={datasetName}
            rowCount={0}
            columns={[]}
            data={[]}
            inline
          />
        </div>
      </main>
    </div>
  )
}
