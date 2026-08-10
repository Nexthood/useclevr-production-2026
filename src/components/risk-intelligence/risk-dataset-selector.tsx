"use client"

import { DeleteDatasetButton } from "@/components/dataset/delete-dataset-button"
import type { RiskDatasetSummary } from "@/lib/risk-intelligence/risk-service"
import { Database } from "lucide-react"
import Link from "next/link"

type RiskDatasetSelectorProps = {
  datasets: RiskDatasetSummary[]
  selectedDatasetId: string | null
  scope: string
}

export function RiskDatasetSelector({ datasets, selectedDatasetId, scope }: RiskDatasetSelectorProps) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Dataset scope</p>
          <p className="text-xs text-muted-foreground">Risk Intelligence calculates one module-scoped dataset at a time.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {datasets.map((dataset) => {
            const isSelected = selectedDatasetId === dataset.id
            const remainingDatasets = datasets.filter((candidate) => candidate.id !== dataset.id)
            const nextSelectedDatasetId = isSelected ? remainingDatasets[0]?.id || null : selectedDatasetId
            const redirectHref = nextSelectedDatasetId
              ? `/app/risk-intelligence?datasetId=${encodeURIComponent(nextSelectedDatasetId)}&scope=${encodeURIComponent(scope)}`
              : `/app/risk-intelligence?scope=${encodeURIComponent(scope)}`

            return (
              <div
                key={dataset.id}
                className={[
                  "group inline-flex min-h-9 items-center overflow-hidden rounded-md border transition",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <Link
                  href={`/app/risk-intelligence?datasetId=${encodeURIComponent(dataset.id)}&scope=${encodeURIComponent(scope)}`}
                  className="inline-flex min-h-9 items-center gap-2 px-3 py-2 text-xs font-medium"
                >
                  <Database className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="max-w-[180px] truncate">{dataset.name}</span>
                </Link>
                <DeleteDatasetButton
                  datasetId={dataset.id}
                  redirectHref={redirectHref}
                  ariaLabel={`Delete ${dataset.name}`}
                  className={[
                    "mr-1 h-7 w-7 shrink-0",
                    isSelected
                      ? "text-primary-foreground/80 hover:bg-primary-foreground/15 hover:text-primary-foreground"
                      : "text-muted-foreground hover:text-destructive",
                  ].join(" ")}
                />
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
