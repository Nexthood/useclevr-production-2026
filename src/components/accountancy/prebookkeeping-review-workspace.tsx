"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { CategorizedTransaction, PrebookkeepingCategorization } from "@/lib/accountancy/prebookkeeping-categorization";
import { Bot, Check, Download, Loader2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";

type FilterKey =
  | "all"
  | "needs_review"
  | "uncategorized"
  | "duplicates"
  | "missing_vat"
  | "missing_supplier"
  | "large_transactions"
  | "revenue"
  | "expenses"
  | "fixed_costs"
  | "payroll"
  | "taxes";

const categoryOptions = [
  ["revenue", "Revenue"],
  ["operating_expenses", "Operating Expenses"],
  ["payroll", "Payroll"],
  ["taxes", "Taxes"],
  ["fixed_costs", "Fixed Costs"],
  ["bank_fees", "Bank Fees"],
  ["transfers", "Transfers"],
  ["assets", "Assets"],
  ["liabilities", "Liabilities"],
  ["equity", "Equity"],
  ["other", "Other"],
] as const;

const filterLabels: Array<[FilterKey, string]> = [
  ["all", "All"],
  ["needs_review", "Needs Review"],
  ["uncategorized", "Uncategorized"],
  ["duplicates", "Duplicates"],
  ["missing_vat", "Missing VAT"],
  ["missing_supplier", "Missing Supplier"],
  ["large_transactions", "Large Transactions"],
  ["revenue", "Revenue"],
  ["expenses", "Expenses"],
  ["fixed_costs", "Fixed Costs"],
  ["payroll", "Payroll"],
  ["taxes", "Taxes"],
];

export function PrebookkeepingReviewWorkspace({
  datasetId,
  datasetName,
  initialCategorization,
}: {
  datasetId: string;
  datasetName: string;
  initialCategorization: PrebookkeepingCategorization;
}) {
  const [categorization, setCategorization] = React.useState(initialCategorization);
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [selectedRows, setSelectedRows] = React.useState<number[]>([]);
  const [saving, setSaving] = React.useState(false);
  const { toast } = useToast();

  const rows = categorization.transactions;
  const filteredRows = rows.filter((row) => matchesFilter(row, filter)).slice(0, 100);
  const filterCounts = React.useMemo(() => buildFilterCounts(rows), [rows]);
  const currency = rows.find((row) => row.currency)?.currency || null;
  const reviewedCount = categorization.reviewSummary.reviewedCount;
  const readyForAccountant = reviewedCount === rows.length && rows.length > 0;

  async function saveReview(payload: Record<string, unknown>, toastTitle = "Review saved") {
    setSaving(true);
    try {
      const response = await fetch("/api/prebookkeeping/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId, ...payload }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || "Review update failed.");
      setCategorization(result.categorization);
      toast({ title: toastTitle, description: "Your bookkeeping review changes were saved." });
    } catch (error) {
      toast({
        title: "Could not save review",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function bulkPayload(action: string, extra: Record<string, unknown> = {}) {
    if (selectedRows.length === 0) {
      toast({ title: "Select transactions first", description: "Choose one or more rows before applying a bulk action." });
      return;
    }
    void saveReview({ action, rowIndexes: selectedRows, ...extra }, "Bulk action saved");
    setSelectedRows([]);
  }

  return (
    <div className="space-y-5">
      <Card className="border-cyan-400/25 bg-cyan-400/5 p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">AI Review Summary</h3>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              <li>{categorization.reviewSummary.transactionsAnalyzed.toLocaleString()} transactions analyzed</li>
              <li>{categorization.reviewSummary.categorizedAutomatically.toLocaleString()} categorized automatically</li>
              <li>{categorization.reviewSummary.requiresReview.toLocaleString()} require review</li>
              <li>{categorization.reviewSummary.possibleDuplicatesDetected.toLocaleString()} possible duplicates detected</li>
              <li>{categorization.reviewSummary.missingDataWarnings.toLocaleString()} missing data warning(s)</li>
              <li>VAT information missing on {categorization.reviewSummary.vatMissingPercent}% of transactions</li>
              <li>Confidence score: {categorization.reviewSummary.confidenceScore}%</li>
            </ul>
          </div>
          <div className="min-w-0 lg:w-80">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-foreground">Review Progress</span>
              <span className="text-muted-foreground">{reviewedCount.toLocaleString()} / {rows.length.toLocaleString()} reviewed</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${categorization.reviewSummary.reviewProgressPercent}%` }} />
            </div>
            <p className={`mt-3 text-sm font-medium ${readyForAccountant ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
              {readyForAccountant ? "Ready for Accountant" : "Review required before accountant export"}
            </p>
          </div>
        </div>
        <div className="mt-5">
          <p className="text-sm font-medium text-foreground">AI recommendations</p>
          <ul className="mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
            {categorization.recommendations.map((recommendation) => (
              <li key={recommendation} className="rounded-md border border-border bg-background px-3 py-2">{recommendation}</li>
            ))}
          </ul>
        </div>
      </Card>

      <Card className="border-border bg-card p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {filterLabels.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                  filter === key ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {label} ({filterCounts[key] || 0})
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => bulkPayload("bulk_accept_suggestions")} disabled={saving}>
              Accept suggestions
            </Button>
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              onChange={(event) => event.target.value && bulkPayload("bulk_change_category", { category: event.target.value })}
              defaultValue=""
              disabled={saving}
            >
              <option value="">Change category</option>
              {categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              onChange={(event) => event.target.value && bulkPayload("bulk_add_vat", { vatRate: Number(event.target.value) })}
              defaultValue=""
              disabled={saving}
            >
              <option value="">Add VAT</option>
              {[0, 5, 10, 20].map((rate) => <option key={rate} value={rate}>{rate}%</option>)}
            </select>
            <Button type="button" variant="outline" size="sm" onClick={() => bulkPayload("bulk_mark_reviewed")} disabled={saving}>
              Mark reviewed
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => bulkPayload("bulk_delete_duplicates")} disabled={saving}>
              Delete duplicates
            </Button>
            {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </div>
      </Card>

      <Card className="border-border bg-card p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Transaction review queue</h3>
            <p className="text-sm text-muted-foreground">Showing {filteredRows.length.toLocaleString()} filtered transaction(s) for {datasetName}.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["csv", "excel", "datev", "quickbooks", "xero"].map((format) => (
              <a key={format} href={`/api/prebookkeeping/export?datasetId=${datasetId}&format=${format}`} className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted">
                <Download className="h-4 w-4" />
                {format.toUpperCase()}
              </a>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-md border border-border">
          <table className="min-w-[1180px] w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2"><input type="checkbox" checked={filteredRows.length > 0 && filteredRows.every((row) => selectedRows.includes(row.rowIndex))} onChange={(event) => setSelectedRows(event.target.checked ? filteredRows.map((row) => row.rowIndex) : [])} /></th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Supplier</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Prediction</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">VAT</th>
                <th className="px-3 py-2">Duplicate</th>
                <th className="px-3 py-2">Review</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((transaction) => (
                <tr key={transaction.rowIndex} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedRows.includes(transaction.rowIndex)}
                      onChange={(event) => setSelectedRows((current) => event.target.checked ? [...current, transaction.rowIndex] : current.filter((rowIndex) => rowIndex !== transaction.rowIndex))}
                    />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{transaction.transactionDate || "Missing"}</td>
                  <td className="max-w-72 px-3 py-2 text-foreground">{transaction.description || "Missing"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{transaction.supplierCustomer || "Missing"}</td>
                  <td className="px-3 py-2 text-right font-medium text-foreground">{formatMoney(transaction.amount, currency)}</td>
                  <td className="px-3 py-2">
                    <div className="space-y-1">
                      <p className={`text-xs font-semibold ${transaction.confidence < 0.7 ? "text-amber-600 dark:text-amber-300" : "text-green-600 dark:text-green-300"}`}>
                        Confidence {Math.round(transaction.confidence * 100)}%
                      </p>
                      <p className="text-xs text-muted-foreground">Suggested: {formatCategory(transaction.suggestedCategory || transaction.category)}</p>
                      {transaction.category === "uncategorized" && transaction.suggestedCategory && (
                        <Button type="button" size="sm" variant="outline" onClick={() => saveReview({ action: "accept_suggestion", rowIndex: transaction.rowIndex }, "Suggestion accepted")} disabled={saving}>
                          Accept
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                      value={transaction.category === "uncategorized" ? "" : transaction.category}
                      onChange={(event) => event.target.value && saveReview({ action: "change_category", rowIndex: transaction.rowIndex, category: event.target.value }, "Category saved")}
                      disabled={saving}
                    >
                      <option value="">Change</option>
                      {categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {[0, 5, 10, 20].map((rate) => (
                        <button key={rate} type="button" onClick={() => saveReview({ action: "add_vat", rowIndex: transaction.rowIndex, vatRate: rate }, "VAT saved")} className="rounded border border-border px-2 py-1 text-xs hover:bg-muted">
                          {rate}%
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{transaction.vatStatus === "missing" ? "Add VAT" : formatMoney(transaction.vatTax, currency)}</p>
                  </td>
                  <td className="px-3 py-2">
                    {transaction.duplicateStatus === "possible_duplicate" ? (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-amber-600 dark:text-amber-300">Possible duplicate</p>
                        {[
                          ["keep_both", "Keep both"],
                          ["merged", "Merge"],
                          ["ignored", "Ignore"],
                        ].map(([status, label]) => (
                          <button key={status} type="button" className="mr-1 rounded border border-border px-2 py-1 text-xs hover:bg-muted" onClick={() => saveReview({ action: "duplicate_action", rowIndex: transaction.rowIndex, duplicateStatus: status }, "Duplicate decision saved")}>
                            {label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">{formatCategory(transaction.duplicateStatus)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {transaction.reviewed ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-300"><Check className="h-3 w-3" /> Reviewed</span>
                    ) : (
                      <Button type="button" size="sm" variant="outline" onClick={() => saveReview({ action: "mark_reviewed", rowIndex: transaction.rowIndex }, "Transaction reviewed")} disabled={saving}>
                        Mark reviewed
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">Ask AI about this bookkeeping</h3>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            "Why are operating expenses so high?",
            "Show duplicate transactions.",
            "Which suppliers increased spending?",
            "What should I review before sending this to my accountant?",
            "Summarize this month's finances.",
          ].map((question) => (
            <Link key={question} href={`/app/assistant?datasetId=${datasetId}&question=${encodeURIComponent(question)}`} className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted">
              {question}
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

function buildFilterCounts(rows: CategorizedTransaction[]): Record<FilterKey, number> {
  return Object.fromEntries(filterLabels.map(([key]) => [key, rows.filter((row) => matchesFilter(row, key)).length])) as Record<FilterKey, number>;
}

function matchesFilter(row: CategorizedTransaction, filter: FilterKey) {
  if (filter === "all") return true;
  if (filter === "needs_review") return row.needsReview;
  if (filter === "uncategorized") return row.category === "uncategorized";
  if (filter === "duplicates") return row.duplicateStatus === "possible_duplicate";
  if (filter === "missing_vat") return row.vatStatus === "missing";
  if (filter === "missing_supplier") return !row.supplierCustomer;
  if (filter === "large_transactions") return row.isLargeTransaction;
  if (filter === "revenue") return row.category === "revenue";
  if (filter === "expenses") return ["operating_expenses", "bank_fees"].includes(row.category);
  if (filter === "fixed_costs") return row.category === "fixed_costs";
  if (filter === "payroll") return row.category === "payroll";
  if (filter === "taxes") return row.category === "taxes";
  return true;
}

function formatCategory(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMoney(value: number | null, currency: string | null) {
  if (value === null || !Number.isFinite(value)) return "Missing";
  if (currency && /^[A-Z]{3}$/.test(currency)) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}
