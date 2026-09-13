"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Cloud,
  Database,
  FileSpreadsheet,
  HardDrive,
  Loader2,
  Share2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClevrSyncPreview } from "@/services/clevrsync";

type Connector = {
  id: string;
  type: string;
  status: string;
  displayName: string;
};

const connectorOptions = [
  { type: "excel", label: "Excel", status: "Available", icon: FileSpreadsheet },
  { type: "google_sheets", label: "Google Sheets", status: "Coming Soon", icon: Database },
  { type: "onedrive", label: "OneDrive", status: "Coming Soon", icon: Cloud },
  { type: "sharepoint", label: "SharePoint", status: "Coming Soon", icon: Share2 },
];

export default function DataConnectionsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [connector, setConnector] = useState<Connector | null>(null);
  const [preview, setPreview] = useState<ClevrSyncPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const canPreview = useMemo(() => Boolean(file && file.name.toLowerCase().endsWith(".xlsx")), [file]);

  async function ensureExcelConnector() {
    if (connector) return connector;
    const response = await fetch("/api/clevrsync/connectors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "excel",
        displayName: file?.name ? `Excel: ${file.name}` : "Excel workbook",
        sourceMeta: { fileName: file?.name },
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Unable to create Excel connection");
    setConnector(payload.connector);
    return payload.connector as Connector;
  }

  async function handlePreview() {
    if (!file || !canPreview) return;
    setIsPreviewing(true);
    setMessage(null);

    try {
      const activeConnector = await ensureExcelConnector();
      const formData = new FormData();
      formData.set("file", file);
      formData.set("connectorId", activeConnector.id);

      const response = await fetch("/api/clevrsync/preview", { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to preview workbook");

      setPreview(payload.preview);
      setMessage("Preview ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to preview workbook");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleSync() {
    if (!file || !connector) return;
    setIsSyncing(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("connectorId", connector.id);

      const response = await fetch("/api/clevrsync/sync", { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.upload?.error || payload.error || "Unable to sync workbook");

      setMessage("Dataset synced");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sync workbook");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Data Connections</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Connect business data sources that feed UseClevr datasets.
            </p>
          </div>
          {connector ? (
            <span className="inline-flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Excel connected
            </span>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {connectorOptions.map((option) => {
          const Icon = option.icon;
          const available = option.type === "excel";
          return (
            <Card key={option.type} className="border-border bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background">
                      <Icon className="h-5 w-5 text-primary" />
                    </span>
                    <CardTitle className="text-base">{option.label}</CardTitle>
                  </div>
                  <span className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground">
                    {option.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  variant={available ? "outline" : "secondary"}
                  className="w-full"
                  disabled={!available}
                >
                  <HardDrive className="mr-2 h-4 w-4" />
                  {available ? "Use source" : "Coming soon"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Excel workbook</CardTitle>
          <CardDescription>XLSX files sync through the existing dataset processing flow.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 rounded-md border border-border bg-background/70 p-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="min-w-0 text-sm text-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPreview(null);
                setMessage(null);
              }}
            />
            <Button type="button" variant="outline" onClick={handlePreview} disabled={!canPreview || isPreviewing}>
              {isPreviewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              Preview
            </Button>
            <Button type="button" onClick={handleSync} disabled={!preview || !connector || isSyncing}>
              {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
              Sync
            </Button>
          </div>

          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

          {preview ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <PreviewMetric label="Worksheet" value={preview.activeWorksheet || "None"} />
                <PreviewMetric label="Rows" value={preview.rowCount.toLocaleString()} />
                <PreviewMetric label="Columns" value={preview.columnCount.toLocaleString()} />
              </div>

              <div className="overflow-hidden rounded-md border border-border">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        {preview.columns.map((column) => (
                          <th key={column.name} scope="col" className="whitespace-nowrap px-3 py-2 text-left font-medium text-foreground">
                            {column.name}
                            <span className="ml-2 text-xs font-normal text-muted-foreground">{column.type}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-background">
                      {preview.rows.slice(0, 8).map((row, index) => (
                        <tr key={index}>
                          {preview.columns.map((column) => (
                            <td key={column.name} className="max-w-56 truncate px-3 py-2 text-muted-foreground">
                              {String(row[column.name] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/70 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
