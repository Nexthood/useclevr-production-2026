"use client"

import { BatchDeleteButton, type BatchDeleteResult } from "@/components/dataset/batch-delete-button"
import { DeleteDatasetButton } from "@/components/dataset/delete-dataset-button"
import { Button } from "@/components/ui/button"
import type { RiskDatasetSummary } from "@/lib/risk-intelligence/risk-service"
import { CheckSquare2, Database, Search, Square } from "lucide-react"
import Link from "next/link"
import * as React from "react"

type RiskDatasetSelectorProps = {
  datasets: RiskDatasetSummary[]
  selectedDatasetId: string | null
  scope: string
}

export function RiskDatasetSelector({ datasets, selectedDatasetId, scope }: RiskDatasetSelectorProps) {
  const [visibleDatasets, setVisibleDatasets] = React.useState(datasets)
  const [isManaging, setIsManaging] = React.useState(false)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [query, setQuery] = React.useState("")

  React.useEffect(() => {
    setVisibleDatasets(datasets)
    setSelectedIds((current) => {
      const availableIds = new Set(datasets.map((dataset) => dataset.id))
      return new Set(Array.from(current).filter((datasetId) => availableIds.has(datasetId)))
    })
  }, [datasets])

  const filteredDatasets = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return visibleDatasets
    return visibleDatasets.filter((dataset) => {
      const searchable = `${dataset.name} ${dataset.fileName || ""} ${dataset.datasetTypeLabel}`.toLowerCase()
      return searchable.includes(normalizedQuery)
    })
  }, [query, visibleDatasets])

  const selectedCount = selectedIds.size
  const filteredIds = filteredDatasets.map((dataset) => dataset.id)
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((datasetId) => selectedIds.has(datasetId))

  const toggleDataset = (datasetId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(datasetId)) {
        next.delete(datasetId)
      } else {
        next.add(datasetId)
      }
      return next
    })
  }

  const selectVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current)
      for (const datasetId of filteredIds) next.add(datasetId)
      return next
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(visibleDatasets.map((dataset) => dataset.id)))
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  const exitManageMode = () => {
    setIsManaging(false)
    setQuery("")
    clearSelection()
  }

  const handleBulkDeleted = (result: BatchDeleteResult) => {
    const deletedIds = new Set(result.deletedIds)
    const failedIds = new Set(result.failed.map((failure) => failure.datasetId))

    if (deletedIds.size > 0) {
      setVisibleDatasets((current) => current.filter((dataset) => !deletedIds.has(dataset.id)))
    }

    setSelectedIds(() => {
      const next = new Set<string>()
      for (const datasetId of failedIds) {
        if (!deletedIds.has(datasetId)) next.add(datasetId)
      }
      return next
    })

    if (failedIds.size === 0) {
      setIsManaging(false)
      setQuery("")
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Dataset scope</p>
          <p className="text-xs text-muted-foreground">Risk Intelligence calculates one module-scoped dataset at a time.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => (isManaging ? exitManageMode() : setIsManaging(true))}
          >
            {isManaging ? "Done" : "Manage datasets"}
          </Button>
        </div>
      </div>

      {isManaging && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative block min-w-0 flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">Search datasets</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search datasets..."
                className="h-9 w-full rounded-md border border-border bg-background px-9 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2 text-xs" aria-live="polite">
              <span className="text-muted-foreground">{selectedCount} selected</span>
              <Button type="button" variant="ghost" size="sm" onClick={selectVisible} disabled={filteredIds.length === 0 || allFilteredSelected}>
                Select visible
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={selectAll} disabled={visibleDatasets.length === 0 || selectedCount === visibleDatasets.length}>
                Select all
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={clearSelection} disabled={selectedCount === 0}>
                Clear
              </Button>
              <BatchDeleteButton
                datasetIds={Array.from(selectedIds)}
                onDeleted={handleBulkDeleted}
                onResetSelection={clearSelection}
              />
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 max-h-[22rem] overflow-y-auto pr-1">
        <div className="flex flex-wrap gap-2">
          {filteredDatasets.map((dataset) => {
            const isSelected = selectedDatasetId === dataset.id
            const isBulkSelected = selectedIds.has(dataset.id)
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
                  isBulkSelected
                    ? "border-primary/70 bg-primary/10 text-foreground ring-1 ring-primary/20"
                    : isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                ].join(" ")}
                data-selected={isBulkSelected ? "true" : undefined}
              >
                {isManaging ? (
                  <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium">
                    <input
                      type="checkbox"
                      checked={isBulkSelected}
                      onChange={() => toggleDataset(dataset.id)}
                      className="h-4 w-4 rounded border-border accent-primary"
                      aria-label={`Select ${dataset.name}`}
                    />
                    {isBulkSelected ? (
                      <CheckSquare2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    ) : (
                      <Square className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    )}
                    <span className="max-w-[180px] truncate">{dataset.name}</span>
                    {isSelected && <span className="text-[11px] text-muted-foreground">(active)</span>}
                  </label>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            )
          })}
          {filteredDatasets.length === 0 && (
            <div className="rounded-md border border-dashed border-border bg-background px-3 py-2 text-xs text-muted-foreground">
              No datasets match this search.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
