"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, FileSpreadsheet, FileText, Mail, PackageCheck } from "lucide-react"

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
    const csv = ["Field,Value", ...packageRows.map((row) => `${escapeCsv(row.label)},${escapeCsv(row.value)}`)].join("\n")
    downloadFile("pre-bookkeeping-package.csv", "text/csv;charset=utf-8", csv)
  }

  function exportExcel() {
    const rows = packageRows
      .map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.value)}</td></tr>`)
      .join("")
    const html = `<table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>`
    downloadFile("pre-bookkeeping-package.xls", "application/vnd.ms-excel;charset=utf-8", html)
  }

  function exportPdf() {
    const reportWindow = window.open("", "_blank", "noopener,noreferrer")
    if (!reportWindow) return
    const rows = packageRows
      .map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.value)}</td></tr>`)
      .join("")
    reportWindow.document.write(`
      <html>
        <head>
          <title>Pre-bookkeeping package</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; color: #111827; }
            h1 { font-size: 24px; margin-bottom: 8px; }
            p { color: #4b5563; }
            table { border-collapse: collapse; width: 100%; margin-top: 24px; }
            th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; vertical-align: top; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Pre-bookkeeping package</h1>
          <p>Prepared for accountant review.</p>
          <table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>
        </body>
      </html>
    `)
    reportWindow.document.close()
    reportWindow.focus()
    reportWindow.print()
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
          disabled={!packageGenerated}
          className="gap-2"
        >
          <FileText className="h-4 w-4" />
          PDF report
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

function escapeCsv(value: unknown) {
  const safeValue = typeof value === "string" ? value : String(value ?? "")
  return `"${safeValue.replace(/"/g, '""')}"`
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
