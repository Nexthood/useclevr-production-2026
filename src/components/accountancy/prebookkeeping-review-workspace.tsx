"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  isPrebookkeepingCategorization,
  normalizePrebookkeepingCategorization,
  type CategorizedTransaction,
  type PrebookkeepingCategorization,
} from "@/lib/accountancy/prebookkeeping-categorization";
import { Bot, Check, Download, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import * as React from "react";

type FilterKey =
  | "all"
  | "needs_review"
  | "auto_reviewed"
  | "uncategorized"
  | "duplicates"
  | "missing_vat"
  | "missing_supplier"
  | "low_confidence"
  | "high_value"
  | "large_transactions"
  | "revenue"
  | "expenses"
  | "fixed_costs"
  | "payroll"
  | "taxes";

type ExportScope = "filtered" | "reviewed" | "all";

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
  ["auto_reviewed", "Auto Reviewed"],
  ["uncategorized", "Uncategorized"],
  ["duplicates", "Duplicates"],
  ["missing_vat", "Missing VAT"],
  ["missing_supplier", "Missing Supplier"],
  ["low_confidence", "Low Confidence"],
  ["high_value", "High Value"],
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
  const [categorization, setCategorization] = React.useState(() => normalizePrebookkeepingCategorization(initialCategorization));
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [selectedRows, setSelectedRows] = React.useState<number[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [exportingFormat, setExportingFormat] = React.useState<string | null>(null);
  const [exportDialogFormat, setExportDialogFormat] = React.useState<"csv" | "excel" | null>(null);
  const [exportScope, setExportScope] = React.useState<ExportScope>("filtered");
  const [exportNotice, setExportNotice] = React.useState<string | null>(null);
  const [autoReviewThreshold, setAutoReviewThreshold] = React.useState<number>(() => categorization.thresholdConfig?.autoReview ?? 0.95);
  const { toast } = useToast();

  const rows = categorization.transactions;
  const reviewSummary = categorization.reviewSummary;
  const filteredRows = rows.filter((row) => matchesFilter(row, filter, categorization.reviewSummary.thresholdConfig?.suggestedReview ?? 0.8));
  const reviewedRows = rows.filter((row) => row.reviewed);
  const filterCounts = React.useMemo(() => buildFilterCounts(rows, categorization.reviewSummary.thresholdConfig?.suggestedReview ?? 0.8), [rows]);
  const exportCounts = React.useMemo(() => ({
    filtered: filteredRows.length,
    reviewed: reviewedRows.length,
    all: rows.length,
  }), [filteredRows.length, reviewedRows.length, rows.length]);
  const currency = rows.find((row) => row.currency)?.currency || null;
  const reviewedCount = reviewSummary.reviewedCount;
  const totalCount = reviewSummary.totalCount || rows.length;
  const readyForAccountant = reviewSummary.status === "ready_for_accountant" || (reviewedCount === totalCount && totalCount > 0);
  const configuredVatRates = React.useMemo(() => {
    const rates = categorization.taxProfile.availableRates.length > 0
      ? categorization.taxProfile.availableRates
      : [categorization.taxProfile.defaultVatRate, categorization.taxProfile.reducedVatRate, categorization.taxProfile.zeroVatRate]
          .filter((rate): rate is number => typeof rate === "number" && Number.isFinite(rate));
    return Array.from(new Set(rates)).sort((a, b) => a - b);
  }, [categorization.taxProfile]);

  async function saveReview(payload: Record<string, unknown>, toastTitle = "Review saved") {
    setSaving(true);
    try {
      const response = await fetch("/api/prebookkeeping/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId, ...payload }),
      });
      const result = await response.json().catch(() => ({}));
      const validated = validateReviewApiResponse(result, response.ok);
      if (!validated.ok) throw new Error(validated.error);
      setCategorization(validated.categorization);
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

  async function runAutoReview(action: "auto_review_all_high_confidence" | "auto_review_selected" | "auto_review_all_filtered" | "auto_review_all", rowsToReview?: number[]) {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        action,
        datasetId,
        threshold: autoReviewThreshold,
      };
      if (rowsToReview && rowsToReview.length > 0) {
        payload.rowIndexes = rowsToReview;
      }
      const response = await fetch("/api/prebookkeeping/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      const validated = validateReviewApiResponse(result, response.ok);
      if (!validated.ok) throw new Error(validated.error);
      setCategorization(validated.categorization);
      const autoCount = validated.categorization.reviewSummary.autoReviewedCount;
      toast({ title: "Auto review complete", description: `${autoCount} transaction(s) were automatically approved.` });
    } catch (error) {
      toast({
        title: "Auto review failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function downloadExport(format: "csv" | "excel", scope: ExportScope) {
    if (exportingFormat) return;
    const rowCount = exportCounts[scope];
    if (rowCount === 0) {
      const message = scope === "reviewed"
        ? "No reviewed transactions are available yet. Please review and approve transactions before exporting."
        : "Choose an export option with at least one transaction.";
      setExportNotice(message);
      toast({ title: "Nothing to export", description: message });
      return;
    }
    setExportNotice(null);
    setExportingFormat(format);
    try {
      const params = new URLSearchParams({
        datasetId,
        format,
        scope,
      });
      if (scope === "filtered") {
        params.set("rowIndexes", filteredRows.map((row) => String(row.rowIndex)).join(","));
      }
      const response = await fetch(`/api/prebookkeeping/export?${params.toString()}`);
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(safeText((result as Record<string, unknown>).error, "Export could not be generated."));
      }

      const blob = await response.blob();
      if (blob.size === 0) throw new Error("Export generated an empty file.");
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filenameFromDisposition(response.headers.get("Content-Disposition")) || `prebookkeeping-${format}-export`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      toast({ title: "Export ready", description: `${format.toUpperCase()} export downloaded with ${rowCount.toLocaleString()} transaction(s).` });
      setExportDialogFormat(null);
    } catch (error) {
      toast({
        title: "Could not export",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setExportingFormat(null);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="border-cyan-400/25 bg-cyan-400/5 p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">AI Review Summary</h3>
            <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-md border border-border bg-background px-3 py-2">
                <p className="text-xs text-muted-foreground">Transactions</p>
                <p className="text-base font-semibold text-foreground">{reviewSummary.transactionsAnalyzed.toLocaleString()}</p>
              </div>
              <div className="rounded-md border border-border bg-background px-3 py-2">
                <p className="text-xs text-muted-foreground">Auto Reviewed</p>
                <p className="text-base font-semibold text-green-600 dark:text-green-300">{reviewSummary.autoReviewedCount.toLocaleString()}</p>
              </div>
              <div className="rounded-md border border-border bg-background px-3 py-2">
                <p className="text-xs text-muted-foreground">Needs Review</p>
                <p className="text-base font-semibold text-amber-600 dark:text-amber-300">{reviewSummary.needsReviewCount.toLocaleString()}</p>
              </div>
              <div className="rounded-md border border-border bg-background px-3 py-2">
                <p className="text-xs text-muted-foreground">Possible Duplicates</p>
                <p className="text-base font-semibold text-foreground">{reviewSummary.possibleDuplicatesDetected.toLocaleString()}</p>
              </div>
              <div className="rounded-md border border-border bg-background px-3 py-2">
                <p className="text-xs text-muted-foreground">Missing VAT</p>
                <p className="text-base font-semibold text-foreground">{Math.round((reviewSummary.vatMissingPercent / 100) * totalCount).toLocaleString()}</p>
              </div>
              <div className="rounded-md border border-border bg-background px-3 py-2">
                <p className="text-xs text-muted-foreground">Confidence</p>
                <p className="text-base font-semibold text-foreground">{reviewSummary.confidenceScore}%</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Auto-review threshold</span>
                <Input
                  type="number"
                  min={0.8}
                  max={0.99}
                  step={0.01}
                  value={autoReviewThreshold}
                  onChange={(event) => setAutoReviewThreshold(Number(event.target.value))}
                  className="h-8 w-16 rounded-md border border-border bg-background px-2 text-xs"
                />
                <span>{Math.round(autoReviewThreshold * 100)}%</span>
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => runAutoReview("auto_review_all_high_confidence")}
                disabled={saving}
                className="gap-2"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Auto-review all high confidence
              </Button>
            </div>
          </div>
          <div className="min-w-0 lg:w-80">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-foreground">Review Progress</span>
              <span className="text-muted-foreground">{reviewedCount.toLocaleString()} / {totalCount.toLocaleString()} reviewed</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${reviewSummary.progress}%` }} />
            </div>
            <p className={`mt-3 text-sm font-medium ${readyForAccountant ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
              {readyForAccountant ? "Ready for Accountant" : formatReviewStatus(reviewSummary.status)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Auto-reviewed: {reviewSummary.autoReviewedCount.toLocaleString()} | Needs review: {reviewSummary.needsReviewCount.toLocaleString()}
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
              disabled={saving || configuredVatRates.length === 0}
            >
              <option value="">Apply VAT to selected</option>
              {configuredVatRates.map((rate) => <option key={rate} value={rate}>{formatVatRate(rate)}</option>)}
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => bulkPayload("apply_business_default_vat")}
              disabled={saving || typeof categorization.taxProfile.defaultVatRate !== "number"}
            >
              Apply Business Default VAT
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => bulkPayload("bulk_mark_reviewed")} disabled={saving}>
              Mark reviewed
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => bulkPayload("bulk_delete_duplicates")} disabled={saving}>
              Delete duplicates
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => runAutoReview("auto_review_selected", selectedRows)}
              disabled={saving || selectedRows.length === 0}
            >
              Auto-review selected
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => runAutoReview("auto_review_all_filtered")}
              disabled={saving}
            >
              Auto-review filtered
            </Button>
            {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </div>
      </Card>

      <Card id="accountant-export" className="border-border bg-card p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Export for Accountant</h3>
            <p className="text-sm text-muted-foreground">
              Prepare reviewed transactions with bookkeeping summary, metadata, and audit information for your accountant.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                if (exportCounts.reviewed === 0) {
                  setExportNotice("No reviewed transactions are available yet. Please review and approve transactions before exporting.");
                  setExportDialogFormat(null);
                  return;
                }
                setExportDialogFormat("excel");
                setExportScope("reviewed");
                setExportNotice(null);
              }}
              disabled={Boolean(exportingFormat)}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export for Accountant
            </Button>
            {(["csv", "excel"] as const).map((format) => (
              <Button
                key={format}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setExportDialogFormat(format);
                  setExportScope(filter === "all" ? "all" : "filtered");
                }}
                disabled={Boolean(exportingFormat)}
                className="gap-2"
              >
                {exportingFormat === format ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {format.toUpperCase()}
              </Button>
            ))}
            {(["datev", "quickbooks", "xero"] as const).map((format) => (
              <Button key={format} type="button" variant="outline" size="sm" disabled title="Coming soon.">
                {format.toUpperCase()} · Coming soon
              </Button>
            ))}
          </div>
        </div>
        {exportNotice && (
          <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold text-foreground">No reviewed transactions are available yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">Please review and approve transactions before exporting.</p>
            <a
              href="#categorized-transactions"
              className="mt-3 inline-flex min-h-9 items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              Review Transactions
            </a>
          </div>
        )}
        {exportDialogFormat && (
          <div className="mt-4 rounded-md border border-border bg-background p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Export {exportDialogFormat.toUpperCase()}</p>
                <p className="mt-1 text-sm text-muted-foreground">Choose which transactions to include. The exported file row count must match this selection.</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setExportDialogFormat(null)} disabled={Boolean(exportingFormat)}>
                Cancel
              </Button>
            </div>
            <fieldset className="mt-4 grid gap-2 md:grid-cols-3">
              {([
                ["filtered", "Current filtered rows", exportCounts.filtered],
                ["reviewed", "Reviewed transactions", exportCounts.reviewed],
                ["all", "All transactions", exportCounts.all],
              ] as const).map(([scope, label, count]) => (
                <label key={scope} className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm hover:bg-muted/50">
                  <input
                    type="radio"
                    name="prebookkeeping-export-scope"
                    value={scope}
                    checked={exportScope === scope}
                    onChange={() => setExportScope(scope)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium text-foreground">{label}</span>
                    <span className="block text-muted-foreground">{count.toLocaleString()} row{count === 1 ? "" : "s"}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={() => downloadExport(exportDialogFormat, exportScope)}
                disabled={Boolean(exportingFormat) || exportCounts[exportScope] === 0}
                className="gap-2"
              >
                {exportingFormat === exportDialogFormat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Export {exportCounts[exportScope].toLocaleString()} row{exportCounts[exportScope] === 1 ? "" : "s"}
              </Button>
              <span className="text-sm text-muted-foreground">CSV and Excel exports use the selected transaction set.</span>
            </div>
          </div>
        )}

        <div id="categorized-transactions" className="mt-4 max-h-[60vh] overflow-auto rounded-md border border-border">
          <div className="border-b border-border bg-background px-4 py-3">
            <h3 className="text-base font-semibold text-foreground">Transaction review queue</h3>
            <p className="text-sm text-muted-foreground">Showing {filteredRows.length.toLocaleString()} filtered transaction(s) for {datasetName}.</p>
          </div>
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
                      {transaction.autoReviewed && (
                        <div className="rounded-md border border-green-500/30 bg-green-500/10 p-2">
                          <p className="text-xs font-semibold text-green-700 dark:text-green-300">Auto Reviewed</p>
                          <p className="text-xs text-muted-foreground">{transaction.autoReviewReason}</p>
                          {transaction.autoReviewEvidence.length > 0 && (
                            <ul className="mt-1 list-disc space-y-0.5 pl-3 text-xs text-muted-foreground">
                              {transaction.autoReviewEvidence.slice(0, 3).map((item, idx) => <li key={idx}>{item}</li>)}
                            </ul>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">Rule: {transaction.autoReviewBusinessRule || "Deterministic classification"}</p>
                          <p className="text-xs text-muted-foreground">Source: {transaction.autoReviewCalculationSource || "deterministic_classification"}</p>
                        </div>
                      )}
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
                    <div className="space-y-2">
                      <div>
                        <p className={`text-xs font-semibold ${transaction.vatNeedsReview || transaction.vatConfidence < 0.7 ? "text-amber-600 dark:text-amber-300" : "text-green-600 dark:text-green-300"}`}>
                          {transaction.vatStatus === "missing" ? "Needs Review" : `Suggested VAT ${formatVatRate(transaction.vatRate)}`}
                        </p>
                        <p className="text-xs text-muted-foreground">Confidence {Math.round(transaction.vatConfidence * 100)}%</p>
                        <p className="max-w-52 text-xs text-muted-foreground">{transaction.vatReason || "No VAT prediction available."}</p>
                        {transaction.vatBusinessRule && <p className="max-w-52 text-xs text-muted-foreground">Rule: {transaction.vatBusinessRule}</p>}
                        <p className="text-xs text-muted-foreground">{transaction.vatStatus === "missing" ? "VAT amount pending" : formatMoney(transaction.vatTax, currency)}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {configuredVatRates.map((rate) => (
                          <button key={rate} type="button" onClick={() => saveReview({ action: "add_vat", rowIndex: transaction.rowIndex, vatRate: rate }, "VAT saved")} className="rounded border border-border px-2 py-1 text-xs hover:bg-muted" disabled={saving}>
                            {formatVatRate(rate)}
                          </button>
                        ))}
                        {transaction.vatRate !== null && (
                          <button type="button" onClick={() => saveReview({ action: "apply_vat_to_matching", rowIndex: transaction.rowIndex, vatRate: transaction.vatRate }, "VAT applied to matching transactions")} className="rounded border border-border px-2 py-1 text-xs hover:bg-muted" disabled={saving}>
                            Apply to matching
                          </button>
                        )}
                      </div>
                    </div>
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
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-300"><Check className="h-3 w-3" /> {transaction.autoReviewed ? "Auto" : "Reviewed"}</span>
                        {transaction.autoReviewed && (
                          <div className="text-xs text-muted-foreground">
                            <p>Risk: {Math.round(transaction.riskScore * 100)}%</p>
                          </div>
                        )}
                      </div>
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

function buildFilterCounts(rows: CategorizedTransaction[], suggestedReviewThreshold: number): Record<FilterKey, number> {
  return Object.fromEntries(filterLabels.map(([key]) => [key, rows.filter((row) => matchesFilter(row, key, suggestedReviewThreshold)).length])) as Record<FilterKey, number>;
}

function matchesFilter(row: CategorizedTransaction, filter: FilterKey, suggestedReviewThreshold: number) {
  if (filter === "all") return true;
  if (filter === "needs_review") return row.needsReview;
  if (filter === "auto_reviewed") return row.autoReviewed;
  if (filter === "uncategorized") return row.category === "uncategorized";
  if (filter === "duplicates") return row.duplicateStatus === "possible_duplicate";
  if (filter === "missing_vat") return row.vatStatus === "missing" || row.vatNeedsReview;
  if (filter === "missing_supplier") return !row.supplierCustomer;
  if (filter === "low_confidence") return row.confidence < suggestedReviewThreshold;
  if (filter === "high_value") return typeof row.amount === "number" && Math.abs(row.amount) >= 10000;
  if (filter === "large_transactions") return row.isLargeTransaction;
  if (filter === "revenue") return row.category === "revenue";
  if (filter === "expenses") return ["operating_expenses", "bank_fees"].includes(row.category);
  if (filter === "fixed_costs") return row.category === "fixed_costs";
  if (filter === "payroll") return row.category === "payroll";
  if (filter === "taxes") return row.category === "taxes";
  return true;
}

function validateReviewApiResponse(value: unknown, responseOk: boolean) {
  if (!isRecord(value)) return { ok: false as const, error: "Review update returned an invalid response." };
  if (!responseOk || value.ok !== true) return { ok: false as const, error: safeText(value.error, "Review update failed.") };
  if (!isPrebookkeepingCategorization(value.categorization)) {
    return { ok: false as const, error: "Review update returned invalid categorization data." };
  }
  return { ok: true as const, categorization: normalizePrebookkeepingCategorization(value.categorization) };
}

function formatCategory(value: unknown) {
  const safeValue = safeText(value, "Uncategorized");
  return safeValue.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatReviewStatus(status: unknown) {
  if (status === "pending") return "Loading analysis";
  if (status === "processing") return "Processing categorization";
  if (status === "failed") return "Failed to process";
  if (status === "ready_for_review") return "Ready for review";
  return "Review required before accountant export";
}

function formatVatRate(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not configured";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}%`;
}

function safeText(value: unknown, fallback: string) {
  if (typeof value === "string") {
    const text = value.trim();
    return text.length > 0 ? text : fallback;
  }
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text.length > 0 ? text : fallback;
}

function filenameFromDisposition(value: string | null) {
  if (!value) return null;
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(value);
  return match ? decodeURIComponent(match[1].replace(/"/g, "")) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function formatMoney(value: number | null, currency: string | null) {
  if (value === null || !Number.isFinite(value)) return "Missing";
  if (currency && /^[A-Z]{3}$/.test(currency)) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}
