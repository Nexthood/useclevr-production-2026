"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Cloud,
  Database,
  FileSpreadsheet,
  HardDrive,
  Loader2,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClevrSyncPreview } from "@/services/clevrsync/types";

type Connector = {
  id: string;
  type: string;
  status: string;
  displayName: string;
  sourceMeta?: Record<string, unknown>;
  updatedAt?: string;
};

type ClevrSyncAccess = {
  enabled: boolean;
  tier: string;
  upgradeRequired: boolean;
  upgradeHref: string;
  connectors: {
    excel: boolean;
    googleSheets: boolean;
    oneDrive: false;
    sharePoint: false;
    scheduledSync: false;
  };
};

const connectorOptions = [
  { type: "excel", label: "Excel Connector", status: "Available", description: "Connect Excel workbooks", icon: FileSpreadsheet },
  { type: "google_sheets", label: "Google Sheets", status: "Available", description: "Connect Google Sheets", icon: Database },
  { type: "onedrive", label: "OneDrive", status: "Coming Soon", description: "Connect OneDrive files", icon: Cloud },
  { type: "sharepoint", label: "SharePoint", status: "Coming Soon", description: "Connect SharePoint files", icon: Share2 },
];

export default function DataConnectionsPage() {
  const searchParams = useSearchParams();
  const [file, setFile] = useState<File | null>(null);
  const [connector, setConnector] = useState<Connector | null>(null);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [preview, setPreview] = useState<ClevrSyncPreview | null>(null);
  const [googlePreview, setGooglePreview] = useState<ClevrSyncPreview | null>(null);
  const [googleSpreadsheet, setGoogleSpreadsheet] = useState("");
  const [googleWorksheet, setGoogleWorksheet] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [googleMessage, setGoogleMessage] = useState<string | null>(null);
  const [access, setAccess] = useState<ClevrSyncAccess | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isGooglePreviewing, setIsGooglePreviewing] = useState(false);
  const [isGoogleSyncing, setIsGoogleSyncing] = useState(false);

  const canPreview = useMemo(
    () => Boolean(file && file.name.toLowerCase().endsWith(".xlsx")),
    [file],
  );
  const googleConnectors = connectors.filter((item) => item.type === "google_sheets");
  const selectedGoogleConnector = googleConnectors[0] ?? null;
  const canGooglePreview = Boolean(selectedGoogleConnector && googleSpreadsheet.trim());

  useEffect(() => {
    loadConnectors();
    loadAccess();
  }, []);

  useEffect(() => {
    if (searchParams.get("google") === "connected") {
      setGoogleMessage("Google Sheets connected");
      loadConnectors();
    } else if (searchParams.get("google") === "error") {
      setGoogleMessage("Google Sheets connection failed");
    }
  }, [searchParams]);

  async function loadConnectors() {
    const response = await fetch("/api/clevrsync/connectors");
    if (!response.ok) return;
    const payload = await response.json();
    setConnectors(Array.isArray(payload.connectors) ? payload.connectors : []);
  }

  async function loadAccess() {
    const response = await fetch("/api/clevrsync/access", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    setAccess(payload.access);
  }

  async function ensureExcelConnector() {
    if (!access?.enabled) throw new Error("ClevrSync requires Pro or Business.");
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
    if (!access?.enabled) return;
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
    if (!access?.enabled) return;
    if (!file || !connector) return;
    setIsSyncing(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("connectorId", connector.id);

      const response = await fetch("/api/clevrsync/sync", { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.upload?.error || payload.error || "Unable to sync workbook");

      setMessage("Dataset synced");
      await loadConnectors();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sync workbook");
    } finally {
      setIsSyncing(false);
    }
  }

  function handleGoogleConnect() {
    if (!access?.enabled) return;
    window.location.href =
      "/api/clevrsync/google/oauth/start?returnTo=/app/settings/data-connections";
  }

  async function handleGooglePreview() {
    if (!access?.enabled) return;
    if (!selectedGoogleConnector || !canGooglePreview) return;
    setIsGooglePreviewing(true);
    setGoogleMessage(null);

    try {
      const response = await fetch("/api/clevrsync/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorId: selectedGoogleConnector.id,
          spreadsheetId: googleSpreadsheet,
          worksheetName: googleWorksheet || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to preview Google Sheet");
      setGooglePreview(payload.preview);
      setGoogleWorksheet(payload.preview?.googleSheets?.worksheetName || "");
      setGoogleMessage("Google Sheet preview ready");
      await loadConnectors();
    } catch (error) {
      setGoogleMessage(error instanceof Error ? error.message : "Unable to preview Google Sheet");
    } finally {
      setIsGooglePreviewing(false);
    }
  }

  async function handleGoogleSync() {
    if (!access?.enabled) return;
    if (!selectedGoogleConnector || !googleSpreadsheet.trim()) return;
    setIsGoogleSyncing(true);
    setGoogleMessage(null);

    try {
      const response = await fetch("/api/clevrsync/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorId: selectedGoogleConnector.id,
          spreadsheetId: googleSpreadsheet,
          worksheetName: googleWorksheet || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.upload?.error || payload.error || "Unable to sync Google Sheet");
      setGoogleMessage("Google Sheet synced");
      await loadConnectors();
    } catch (error) {
      setGoogleMessage(error instanceof Error ? error.message : "Unable to sync Google Sheet");
    } finally {
      setIsGoogleSyncing(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Data Connections
            </h2>
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
          const available = option.type === "excel" || option.type === "google_sheets";
          const locked =
            access?.enabled === false &&
            (option.type === "excel" || option.type === "google_sheets");
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
                    {locked ? "Premium" : option.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {locked ? (
                  <Link href={access?.upgradeHref || "/app/settings/checkout?plan=pro_monthly&discount=auto"}>
                    <Button type="button" className="w-full">
                      Upgrade to Pro
                    </Button>
                  </Link>
                ) : (
                  <Button
                    type="button"
                    variant={available ? "outline" : "secondary"}
                    className="w-full"
                    disabled={!available}
                    onClick={option.type === "google_sheets" ? handleGoogleConnect : undefined}
                  >
                    <HardDrive className="mr-2 h-4 w-4" />
                    {option.type === "google_sheets"
                      ? "Connect"
                      : available
                        ? "Use source"
                        : "Coming soon"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Google Sheets</CardTitle>
              <CardDescription>
                Connect a Google account, select a spreadsheet, preview a worksheet, and sync it
                into UseClevr datasets.
              </CardDescription>
            </div>
            <ConnectionBadge connector={selectedGoogleConnector} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedGoogleConnector ? (
            access?.enabled === false ? (
              <PremiumLock access={access} />
            ) : (
              <Button type="button" onClick={handleGoogleConnect}>
                <Database className="mr-2 h-4 w-4" />
                Connect Google Sheets
              </Button>
            )
          ) : (
            <>
              <div className="grid gap-3 rounded-md border border-border bg-background/70 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(180px,240px)_auto_auto] lg:items-center">
                <input
                  type="text"
                  value={googleSpreadsheet}
                  onChange={(event) => {
                    setGoogleSpreadsheet(event.target.value);
                    setGooglePreview(null);
                  }}
                  placeholder="Google Sheets URL or spreadsheet ID"
                  className="h-11 min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                />
                <select
                  value={googleWorksheet}
                  onChange={(event) => {
                    setGoogleWorksheet(event.target.value);
                    setGooglePreview(null);
                  }}
                  className="h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">First worksheet</option>
                  {googlePreview?.googleSheets?.worksheets.map((worksheet) => (
                    <option key={worksheet.title} value={worksheet.title}>
                      {worksheet.title}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGooglePreview}
                  disabled={!access?.enabled || !canGooglePreview || isGooglePreviewing}
                >
                  {isGooglePreviewing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                  )}
                  Preview
                </Button>
                <Button
                  type="button"
                  onClick={handleGoogleSync}
                  disabled={!access?.enabled || !canGooglePreview || isGoogleSyncing}
                >
                  {isGoogleSyncing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="mr-2 h-4 w-4" />
                  )}
                  {selectedGoogleConnector.sourceMeta?.datasetId ? "Sync now" : "Connect & Analyze"}
                </Button>
              </div>
              {access?.enabled === false ? <PremiumLock access={access} /> : null}

              {googleMessage ? (
                <p className="text-sm text-muted-foreground">{googleMessage}</p>
              ) : null}
              {selectedGoogleConnector.sourceMeta?.lastSuccessfulSync ? (
                <p className="text-sm text-muted-foreground">
                  Last synced{" "}
                  {new Date(
                    String(selectedGoogleConnector.sourceMeta.lastSuccessfulSync),
                  ).toLocaleString()}
                </p>
              ) : null}

              {googlePreview ? <PreviewTable preview={googlePreview} /> : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Excel workbook</CardTitle>
          <CardDescription>
            Upload and sync XLSX files through ClevrSync. Requires Pro or Business.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {access?.enabled === false ? (
            <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Excel workbook sync requires Pro or Business. You can still upload CSV and XLSX files directly through the Datasets page with your Free plan.
              </p>
            </div>
          ) : null}
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
            <Button
              type="button"
              variant="outline"
              onClick={handlePreview}
              disabled={!access?.enabled || !canPreview || isPreviewing}
            >
              {isPreviewing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              Preview
            </Button>
            <Button
              type="button"
              onClick={handleSync}
              disabled={!access?.enabled || !preview || !connector || isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Database className="mr-2 h-4 w-4" />
              )}
              Sync
            </Button>
          </div>

          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

          {preview ? (
            <div className="space-y-4">
              <PreviewTable preview={preview} />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ConnectionBadge({ connector }: { connector: Connector | null }) {
  if (!connector) {
    return (
      <span className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground">
        Not connected
      </span>
    );
  }

  const label =
    connector.status === "connected"
      ? "Connected"
      : connector.status === "reconnect_required"
        ? "Reconnect required"
        : connector.status === "error"
          ? "Error"
          : connector.status === "syncing"
            ? "Syncing"
            : connector.status;

  return (
    <span className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground">
      {label}
    </span>
  );
}

function PremiumLock({ access }: { access: ClevrSyncAccess }) {
  return (
    <div className="rounded-md border border-primary/20 bg-primary/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">ClevrSync connectors require Pro or Business</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect external data sources like Excel workbooks and Google Sheets through ClevrSync to unlock advanced features.
          </p>
        </div>
        <Link href={access.upgradeHref}>
          <Button type="button">Upgrade to Pro</Button>
        </Link>
      </div>
    </div>
  );
}

function PreviewTable({ preview }: { preview: ClevrSyncPreview }) {
  return (
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
                  <th
                    key={column.name}
                    scope="col"
                    className="whitespace-nowrap px-3 py-2 text-left font-medium text-foreground"
                  >
                    {column.name}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {column.type}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {preview.rows.slice(0, 8).map((row, index) => (
                <tr key={index}>
                  {preview.columns.map((column) => (
                    <td
                      key={column.name}
                      className="max-w-56 truncate px-3 py-2 text-muted-foreground"
                    >
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
