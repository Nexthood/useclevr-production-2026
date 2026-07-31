import { DashboardSubpageLayout } from "@/components/layout/dashboard-subpage-layout"
import { AccountancyUpload } from "@/components/accountancy/accountancy-upload"
import { StartCategorizationButton } from "@/components/accountancy/prebookkeeping-categorization-actions"
import { Card } from "@/components/ui/card"
import { auth } from "@/lib/auth/auth"
import {
  isPrebookkeepingCategorization,
  type CategorizedTransaction,
  type PrebookkeepingCategorization,
} from "@/lib/accountancy/prebookkeeping-categorization"
import { resolveDatasetType } from "@/lib/data/dataset-category"
import { getDb } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { ArrowRight, Bot, Download, FileText, ListChecks, Upload } from "lucide-react"
import Link from "next/link"
import type React from "react"

type PrebookkeepingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type FocusedPrebookkeepingDataset = {
  id: string
  name: string
  fileName: string
  rowCount: number
  columnCount: number
  analysis: unknown
  precomputedMetrics: unknown
  datasetType: string | null
  analysisMessage: string | null
}

export default async function PrebookkeepingPage({ searchParams }: PrebookkeepingPageProps) {
  const session = await auth()
  const userId = session?.user?.id

  let _activeDatasets = 0
  let focusedDataset: FocusedPrebookkeepingDataset | null = null

  const resolvedSearchParams = await searchParams
  const rawDatasetId = resolvedSearchParams?.datasetId
  const focusedDatasetId = Array.isArray(rawDatasetId) ? rawDatasetId[0] : rawDatasetId

  if (userId) {
    const db = getDb()
    if (db) {
      try {
        const prebookkeepingDatasets = await db.query.datasets.findMany({
          where: eq(datasets.userId, userId),
          columns: {
            datasetType: true,
            analysis: true,
          },
        })

        if (focusedDatasetId) {
          const datasetWhere = session?.user?.role === "superadmin"
            ? eq(datasets.id, focusedDatasetId)
            : and(eq(datasets.id, focusedDatasetId), eq(datasets.userId, userId))
          focusedDataset = await db.query.datasets.findFirst({
            where: datasetWhere,
            columns: {
              id: true,
              name: true,
              fileName: true,
              rowCount: true,
              columnCount: true,
              analysis: true,
              precomputedMetrics: true,
              datasetType: true,
              analysisMessage: true,
            },
          }) ?? null
          if (focusedDataset && resolveDatasetType(focusedDataset.datasetType, focusedDataset.analysis) !== "prebookkeeping") {
            focusedDataset = null
          }
        }

        _activeDatasets = prebookkeepingDatasets.filter((dataset) =>
          resolveDatasetType(dataset.datasetType, dataset.analysis) === "prebookkeeping"
        ).length
      } catch {
        // Continue without stats
      }
    }
  }

  const categorization = getPrebookkeepingCategorization(focusedDataset?.analysis)

  return (
    <DashboardSubpageLayout
      title="Pre-bookkeeping"
      description="Upload invoices, receipts, and bank exports for automated categorization and bookkeeping summaries."
      breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Pre-bookkeeping" }]}
      icon={FileText}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/app/prebookkeeping">
            <span className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
              <Upload className="h-4 w-4" />
              Upload document
            </span>
          </Link>
        </div>
      }
    >
      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-6">
        <div className="max-w-6xl mx-auto space-y-5">
          <div id="prebookkeeping-upload">
            <AccountancyUpload datasetType="prebookkeeping" />
          </div>

          {focusedDataset && (
            <PrebookkeepingReviewPanel dataset={focusedDataset} categorization={categorization} />
          )}

          {!focusedDataset && (
            <Card className="border-border bg-card p-6">
              <div className="flex flex-col items-center justify-center gap-4 py-12">
                <FileText className="h-12 w-12 text-muted-foreground" />
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-foreground">No pre-bookkeeping dataset selected</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Upload invoices, receipts, bank exports, PDFs, Excel, or CSV files for pre-bookkeeping insights.
                  </p>
                </div>
                <Link
                  href="/app/prebookkeeping"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                >
                  <Upload className="h-4 w-4" />
                  Upload document
                </Link>
              </div>
            </Card>
          )}
        </div>
      </div>
    </DashboardSubpageLayout>
  )
}

function PrebookkeepingReviewPanel({
  dataset,
  categorization,
}: {
  dataset: FocusedPrebookkeepingDataset
  categorization: PrebookkeepingCategorization | null
}) {
  const currency = categorization?.transactions.find((transaction) => transaction.currency)?.currency || null
  const visibleTransactions = categorization?.transactions.slice(0, 25) || []
  const status = categorization ? "Ready for review" : "Categorization not started"

  return (
    <div className="space-y-5">
      <Card className="border-cyan-400/25 bg-cyan-400/5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">
              Routed pre-bookkeeping dataset
            </p>
            <h2 className="mt-2 text-xl font-semibold text-foreground">
              {dataset.name || dataset.fileName}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This upload is saved in Pre-bookkeeping so invoices, receipts, and bank exports stay separate from the main Dashboard.
            </p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:min-w-80">
            <ProfileContextRow label="Rows" value={dataset.rowCount.toLocaleString()} />
            <ProfileContextRow label="Columns" value={dataset.columnCount.toLocaleString()} />
            <ProfileContextRow label="Type" value="Pre-bookkeeping" />
            <ProfileContextRow label="Status" value={status} />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {categorization ? (
            <>
              <ActionLink href="#categorized-transactions" label="Review transactions" icon={<ListChecks className="h-4 w-4" />} />
              <ActionLink href="#bookkeeping-summary" label="Open bookkeeping summary" icon={<ArrowRight className="h-4 w-4" />} />
              <ActionLink href={`/api/reports/download?datasetId=${dataset.id}&format=csv`} label="Export for accountant" icon={<Download className="h-4 w-4" />} />
              <ActionLink href={`/app/assistant?datasetId=${dataset.id}`} label="Ask AI about this dataset" icon={<Bot className="h-4 w-4" />} />
            </>
          ) : (
            <StartCategorizationButton datasetId={dataset.id} />
          )}
        </div>
      </Card>

      {categorization && (
        <>
          <section id="bookkeeping-summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Categorized transactions" value={categorization.categorizedCount.toLocaleString()} />
            <SummaryCard label="Uncategorized count" value={categorization.uncategorizedCount.toLocaleString()} />
            <SummaryCard label="Income total" value={formatMoney(categorization.incomeTotal, currency)} />
            <SummaryCard label="Expense total" value={formatMoney(categorization.expenseTotal, currency)} />
            <SummaryCard label="VAT/tax summary" value={formatMoney(categorization.vatTaxSummary.total, currency)} detail={`${categorization.vatTaxSummary.rowsWithTax.toLocaleString()} row(s)`} />
            <SummaryCard label="Possible duplicates" value={categorization.possibleDuplicates.length.toLocaleString()} />
            <SummaryCard label="Missing data warnings" value={categorization.missingDataWarnings.length.toLocaleString()} />
            <SummaryCard label="Ready status" value="Ready for review" />
          </section>

          <Card className="border-border bg-card p-5">
            <h3 className="text-base font-semibold text-foreground">Category breakdown</h3>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(categorization.categoryCounts).map(([category, count]) => (
                <ProfileContextRow key={category} label={formatCategory(category)} value={count.toLocaleString()} />
              ))}
            </div>
          </Card>

          <Card id="categorized-transactions" className="border-border bg-card p-5">
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-semibold text-foreground">Categorized transactions</h3>
              <p className="text-sm text-muted-foreground">
                Showing the first {visibleTransactions.length.toLocaleString()} of {categorization.transactions.length.toLocaleString()} transaction(s).
              </p>
            </div>
            <div className="mt-4 overflow-x-auto rounded-md border border-border">
              <table className="min-w-[920px] w-full text-sm">
                <thead className="sticky top-0 bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2">Supplier/customer</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2">VAT/tax</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTransactions.map((transaction) => (
                    <TransactionRow key={transaction.rowIndex} transaction={transaction} currency={currency} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {(categorization.missingDataWarnings.length > 0 || categorization.possibleDuplicates.length > 0) && (
            <Card className="border-amber-500/30 bg-amber-500/10 p-5">
              <h3 className="text-base font-semibold text-foreground">Review warnings</h3>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <WarningList title="Missing data" items={categorization.missingDataWarnings} empty="No missing data warnings." />
                <WarningList
                  title="Possible duplicates"
                  items={categorization.possibleDuplicates.map((duplicate) => `${duplicate.count} rows share ${duplicate.key}`)}
                  empty="No possible duplicates detected."
                />
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function getPrebookkeepingCategorization(analysis: unknown) {
  if (!analysis || typeof analysis !== "object" || Array.isArray(analysis)) return null
  const categorization = (analysis as { prebookkeepingCategorization?: unknown }).prebookkeepingCategorization
  return isPrebookkeepingCategorization(categorization) ? categorization : null
}

function ProfileContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[12rem] text-right font-medium text-foreground">{value || "Not configured"}</span>
    </div>
  )
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card className="border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </Card>
  )
}

function ActionLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:border-primary/50 hover:bg-muted"
    >
      {icon}
      {label}
    </Link>
  )
}

function TransactionRow({ transaction, currency }: { transaction: CategorizedTransaction; currency: string | null }) {
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 text-muted-foreground">{transaction.transactionDate || "Missing"}</td>
      <td className="max-w-80 px-3 py-2 text-foreground">{transaction.description || "Missing"}</td>
      <td className="px-3 py-2 text-muted-foreground">{transaction.supplierCustomer || "Missing"}</td>
      <td className="px-3 py-2 text-right font-medium text-foreground">{formatMoney(transaction.amount, currency)}</td>
      <td className="px-3 py-2 text-muted-foreground">{transaction.vatTax === null ? "Missing" : formatMoney(transaction.vatTax, currency)}</td>
      <td className="px-3 py-2">
        <span className="inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-xs font-medium text-cyan-700 dark:text-cyan-200">
          {formatCategory(transaction.category)}
        </span>
      </td>
      <td className="px-3 py-2 text-muted-foreground">{transaction.invoiceReference || "Missing"}</td>
    </tr>
  )
}

function WarningList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {(items.length > 0 ? items : [empty]).map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  )
}

function formatCategory(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatMoney(value: number | null, currency: string | null) {
  if (value === null || !Number.isFinite(value)) return "Missing"
  if (currency && /^[A-Z]{3}$/.test(currency)) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value)
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value)
}
