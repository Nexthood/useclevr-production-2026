"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { buildAccountancyPackageCsv } from "@/lib/accountancy/package-csv"
import { debugError } from "@/lib/utils/debug"
import { Download, FileSpreadsheet, FileText, Loader2, Mail, PackageCheck } from "lucide-react"

interface AccountancyPackageFormProps {
  initialCompanyName: string
  initialTaxPeriod: string
  packageReady: boolean
  profileContext: { label: string; value: string }[]
}

export function AccountancyPackageForm({
  initialCompanyName,
  initialTaxPeriod,
  packageReady,
  profileContext,
}: AccountancyPackageFormProps) {
  const [accountantEmail, setAccountantEmail] = useState("")
  const [companyName, setCompanyName] = useState(initialCompanyName)
  const [taxPeriod, setTaxPeriod] = useState(initialTaxPeriod)
  const [message, setMessage] = useState("")
  const [packageGenerated, setPackageGenerated] = useState(packageReady)
  const [pdfExporting, setPdfExporting] = useState(false)
  const { toast } = useToast()

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent(`Pre-bookkeeping package${companyName ? ` - ${companyName}` : ""}`)
    const body = encodeURIComponent([
      `Company: ${companyName || "Not provided"}`,
      `Tax period: ${taxPeriod || "Not provided"}`,
      "",
      message || "Please review the attached pre-bookkeeping package.",
    ].join("\n"))
    return `mailto:${accountantEmail}?subject=${subject}&body=${body}`
  }, [accountantEmail, companyName, message, taxPeriod])

  const packageRows = useMemo(() => [
    { label: "Company name", value: companyName || "Not provided" },
    { label: "Tax period", value: taxPeriod || "Not provided" },
    { label: "Accountant email", value: accountantEmail || "Not provided" },
    { label: "Notes/message", value: message || "Not provided" },
    ...profileContext,
  ], [accountantEmail, companyName, message, profileContext, taxPeriod])

  function downloadFile(filename: string, mimeType: string, content: string) {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function exportCsv() {
    const csv = buildAccountancyPackageCsv(packageRows)
    downloadFile("pre-bookkeeping-package.csv", "text/csv;charset=utf-8", csv)
  }

  function exportExcel() {
    const rows = packageRows
      .map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.value)}</td></tr>`)
      .join("")
    const html = `<table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>`
    downloadFile("pre-bookkeeping-package.xls", "application/vnd.ms-excel;charset=utf-8", html)
  }

  async function exportPdf() {
    if (pdfExporting) return
    setPdfExporting(true)
    try {
      const response = await fetch("/api/accountancy/package/pdf?disposition=inline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          taxPeriod,
          accountantEmail,
          message,
          fields: packageRows,
        }),
      })
      const contentType = response.headers.get("Content-Type") || ""
      if (!response.ok) {
        throw new Error(await readExportError(response))
      }
      if (!contentType.toLowerCase().includes("application/pdf")) {
        throw new Error("PDF export returned an invalid file type.")
      }

      const blob = await response.blob()
      if (blob.size === 0) throw new Error("PDF export generated an empty file.")

      const pdfBlob = blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" })
      const objectUrl = URL.createObjectURL(pdfBlob)
      const opened = window.open(objectUrl, "_blank", "noopener,noreferrer")
      if (!opened) {
        const link = document.createElement("a")
        link.href = objectUrl
        link.download = filenameFromDisposition(response.headers.get("Content-Disposition")) || "pre-bookkeeping-package.pdf"
        document.body.appendChild(link)
        link.click()
        link.remove()
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch (error) {
      debugError("[ACCOUNTANCY_PACKAGE] PDF export failed", error)
      toast({
        title: "Could not export PDF",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      })
    } finally {
      setPdfExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Accountant email</span>
          <input
            type="email"
            value={accountantEmail}
            onChange={(event) => setAccountantEmail(event.target.value)}
            placeholder="accountant@example.com"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Company name</span>
          <input
            type="text"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Company name"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Tax period</span>
          <input
            type="text"
            value={taxPeriod}
            onChange={(event) => setTaxPeriod(event.target.value)}
            placeholder="2026 Q2 or FY 2026"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
      </div>

      <label className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Notes/message</span>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Add questions, missing documents, or accountant instructions."
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => setPackageGenerated(true)}
          className="gap-2"
        >
          <PackageCheck className="h-4 w-4" />
          Generate bookkeeping package
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={exportPdf}
          disabled={!packageGenerated || pdfExporting}
          className="gap-2"
        >
          {pdfExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {pdfExporting ? "Preparing PDF..." : "PDF report"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={exportExcel}
          disabled={!packageGenerated}
          className="gap-2"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Excel file
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={exportCsv}
          disabled={!packageGenerated}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          CSV file
        </Button>
        <a
          href={mailtoHref}
          aria-disabled={!packageGenerated || !accountantEmail}
          className={`inline-flex h-11 items-center justify-center gap-2 rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground transition hover:bg-secondary/80 ${
            packageGenerated && accountantEmail ? "" : "pointer-events-none opacity-50"
          }`}
        >
          <Mail className="h-4 w-4" />
          Send to accountant
        </a>
      </div>

      <p className="text-xs text-muted-foreground">
        {packageGenerated
          ? "Package draft is ready for export and accountant email handoff."
          : "Generate the package after uploading accounting documents and reviewing the structured summary."}
      </p>
    </div>
  )
}

function escapeHtml(value: unknown) {
  const safeValue = typeof value === "string" ? value : String(value ?? "")
  return safeValue
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

async function readExportError(response: Response) {
  const result = await response.json().catch(() => null)
  if (result && typeof result === "object" && "error" in result && typeof result.error === "string") {
    return result.error
  }
  return "PDF report could not be generated."
}

function filenameFromDisposition(disposition: string | null) {
  if (!disposition) return null
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (encoded) return decodeURIComponent(encoded)
  const regular = disposition.match(/filename="?([^";]+)"?/i)?.[1]
  return regular || null
}
