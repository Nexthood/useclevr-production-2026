"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Cloud,
  Database,
  FileSpreadsheet,
  Loader2,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

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

type ConnectorType = "google_sheets" | "onedrive" | "sharepoint";

type SpreadsheetSummary = {
  id: string;
  name: string;
  modifiedTime: string | null;
  shared: boolean;
  ownedByMe: boolean;
};

type MicrosoftWorkbookSummary = {
  driveId: string | null;
  itemId: string;
  name: string;
  folderPath: string | null;
  lastModified: string | null;
  size: number | null;
};

type MicrosoftSiteSummary = {
  id: string;
  displayName: string;
  webUrl: string | null;
};

type MicrosoftDriveSummary = {
  id: string;
  name: string;
  webUrl: string | null;
  driveType: string | null;
  lastModified: string | null;
};

type MicrosoftWorksheetSummary = {
  id: string;
  name: string;
  position: number;
};

type WorksheetSummary = {
  id: number | null;
  title: string;
  index: number;
};

type ClevrSyncAccess = {
  enabled: boolean;
  tier: string;
  upgradeRequired: boolean;
  upgradeHref: string;
  connectors: {
    googleSheets: boolean;
    oneDrive: boolean;
    sharePoint: boolean;
    scheduledSync: boolean;
  };
};

type ClevrSyncSyncPayload = {
  datasetId?: string | null;
  redirectUrl?: string | null;
  redirectTo?: string | null;
  upload?: {
    datasetId?: string | null;
    redirectUrl?: string | null;
    redirectTo?: string | null;
    error?: string | null;
  };
  error?: string | null;
};

type ResourceItem = { id: string; name: string; meta: string | null };

const connectorOptions: Array<{
  type: ConnectorType;
  label: string;
  status: string;
  description: string;
  icon: typeof Database;
}> = [
  { type: "google_sheets", label: "Google Sheets", status: "Available", description: "Connect Google Sheets", icon: Database },
  { type: "onedrive", label: "OneDrive", status: "Available", description: "Connect OneDrive Excel workbooks", icon: Cloud },
  { type: "sharepoint", label: "SharePoint", status: "Available", description: "Connect SharePoint Excel workbooks", icon: Share2 },
];

export default function DataConnectionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [accessLoaded, setAccessLoaded] = useState(false);
  const [googlePreview, setGooglePreview] = useState<ClevrSyncPreview | null>(null);
  const [googleSpreadsheet, setGoogleSpreadsheet] = useState("");
  const [googleWorksheet, setGoogleWorksheet] = useState("");
  const [googleMessage, setGoogleMessage] = useState<string | null>(null);
  const [access, setAccess] = useState<ClevrSyncAccess | null>(null);
  const [isGooglePreviewing, setIsGooglePreviewing] = useState(false);
  const [isGoogleSyncing, setIsGoogleSyncing] = useState(false);
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetSummary[]>([]);
  const [spreadsheetSearch, setSpreadsheetSearch] = useState("");
  const [isListingSpreadsheets, setIsListingSpreadsheets] = useState(false);
  const [spreadsheetsError, setSpreadsheetsError] = useState<string | null>(null);
  const [reconnectHint, setReconnectHint] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [worksheets, setWorksheets] = useState<WorksheetSummary[]>([]);
  const [isListingWorksheets, setIsListingWorksheets] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerActiveIndex, setPickerActiveIndex] = useState(0);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [selectedSpreadsheetName, setSelectedSpreadsheetName] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<ConnectorType>("google_sheets");
  const loadAbortRef = useRef<AbortController | null>(null);
  const worksheetAbortRef = useRef<AbortController | null>(null);
  const manualUrlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedConnectorRef = useRef<string | null>(null);

  const selectedGoogleConnector = connectors.find((item) => item.type === "google_sheets") ?? null;
  const googleConnectorId = selectedGoogleConnector?.id ?? null;
  const canGooglePreview = Boolean(selectedGoogleConnector && googleSpreadsheet.trim());
  const pickerLabel =
    spreadsheets.find((sheet) => sheet.id === googleSpreadsheet)?.name ||
    selectedSpreadsheetName ||
    (googleSpreadsheet ? "Selected spreadsheet" : "Choose spreadsheet");
  const activeConnector =
    activePanel === "google_sheets"
      ? selectedGoogleConnector
      : connectors.find((item) => item.type === activePanel) ?? null;

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
    const microsoftState = searchParams.get("microsoft");
    if (microsoftState === "connected") {
      setGoogleMessage("Microsoft connected");
      loadConnectors();
    } else if (microsoftState === "cancelled") {
      setGoogleMessage("Microsoft connection was cancelled");
    } else if (microsoftState === "error") {
      setGoogleMessage("Microsoft connection failed");
    }
    const connectorTypeParam = searchParams.get("connectorType");
    if (connectorTypeParam === "onedrive" || connectorTypeParam === "sharepoint") {
      setActivePanel(connectorTypeParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!googleConnectorId) return;
    if (initializedConnectorRef.current === googleConnectorId) return;
    initializedConnectorRef.current = googleConnectorId;
    setSpreadsheets([]);
    setNextPageToken(null);
    setSpreadsheetsError(null);
    setReconnectHint(null);
    setPickerOpen(false);
    setPickerActiveIndex(0);
    const linkedSpreadsheetId = readMetaString(selectedGoogleConnector?.sourceMeta?.spreadsheetId);
    if (linkedSpreadsheetId) {
      setGoogleSpreadsheet(linkedSpreadsheetId);
      setSelectedSpreadsheetName(
        readMetaString(selectedGoogleConnector?.sourceMeta?.spreadsheetName) || "Selected spreadsheet",
      );
      const linkedWorksheet = readMetaString(selectedGoogleConnector?.sourceMeta?.worksheetName);
      setGoogleWorksheet(linkedWorksheet ?? "");
      void fetchWorksheets(linkedSpreadsheetId, googleConnectorId);
    } else {
      setGoogleSpreadsheet("");
      setGoogleWorksheet("");
      setSelectedSpreadsheetName(null);
      setWorksheets([]);
    }
    void loadSpreadsheets();
  }, [googleConnectorId]);

  useEffect(() => {
    if (!pickerOpen) return;
    const handle = setTimeout(() => {
      void loadSpreadsheets({ search: spreadsheetSearch.trim() || null });
    }, 300);
    return () => clearTimeout(handle);
  }, [spreadsheetSearch, pickerOpen]);

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
    setAccessLoaded(true);
  }

  async function loadSpreadsheets(options?: {
    search?: string | null;
    pageToken?: string | null;
    append?: boolean;
  }) {
    if (!access?.enabled || !selectedGoogleConnector) return;
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    if (!options?.append) {
      setIsListingSpreadsheets(true);
      setSpreadsheetsError(null);
    }
    setReconnectHint(null);

    try {
      const params = new URLSearchParams();
      if (options?.search) params.set("search", options.search);
      if (options?.pageToken) params.set("pageToken", options.pageToken);
      const response = await fetch(`/api/clevrsync/google/spreadsheets?${params.toString()}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (!response.ok) {
        if (response.status === 401) {
          setReconnectHint(
            payload?.error || "Reconnect Google Sheets to browse your spreadsheets.",
          );
          setSpreadsheets([]);
          setNextPageToken(null);
        } else {
          setSpreadsheetsError(payload?.error || "Unable to list spreadsheets");
        }
        return;
      }
      const list = Array.isArray(payload?.spreadsheets) ? payload.spreadsheets : [];
      setSpreadsheets((current) => (options?.append ? [...current, ...list] : list));
      setNextPageToken(typeof payload?.nextPageToken === "string" ? payload.nextPageToken : null);
    } catch (error) {
      if (controller.signal.aborted) return;
      setSpreadsheetsError(error instanceof Error ? error.message : "Unable to list spreadsheets");
    } finally {
      if (!controller.signal.aborted) setIsListingSpreadsheets(false);
    }
  }

  async function fetchWorksheets(spreadsheetValue: string, connectorIdOverride?: string) {
    const connectorId = connectorIdOverride || selectedGoogleConnector?.id;
    const trimmed = spreadsheetValue.trim();
    if (!access?.enabled || !connectorId || !trimmed) return;
    worksheetAbortRef.current?.abort();
    const controller = new AbortController();
    worksheetAbortRef.current = controller;
    setIsListingWorksheets(true);

    try {
      const params = new URLSearchParams({ spreadsheetId: trimmed });
      params.set("connectorId", connectorId);
      const response = await fetch(`/api/clevrsync/google/worksheets?${params.toString()}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (!response.ok) {
        setWorksheets([]);
        if (response.status === 401) {
          setReconnectHint(payload?.error || "Reconnect Google Sheets");
        } else {
          setGoogleMessage(payload?.error || "Unable to load worksheets");
        }
        return;
      }
      const list: WorksheetSummary[] = Array.isArray(payload?.worksheets)
        ? payload.worksheets.map((item: { id?: unknown; title?: unknown; index?: unknown }, index: number) => ({
            id: typeof item?.id === "number" ? item.id : null,
            title: typeof item?.title === "string" && item.title ? item.title : `Sheet ${index + 1}`,
            index: typeof item?.index === "number" ? item.index : index,
          }))
        : [];
      setWorksheets(list);
      if (typeof payload?.spreadsheetName === "string" && payload.spreadsheetName) {
        setSelectedSpreadsheetName(payload.spreadsheetName);
      }
      const titles = list.map((item) => item.title);
      setGoogleWorksheet((current) => (current && titles.includes(current) ? current : titles[0] || ""));
      setGoogleMessage(null);
    } catch (error) {
      if (!controller.signal.aborted) {
        setGoogleMessage(error instanceof Error ? error.message : "Unable to load worksheets");
      }
    } finally {
      if (!controller.signal.aborted) setIsListingWorksheets(false);
    }
  }

  function selectSpreadsheet(sheet: SpreadsheetSummary) {
    setPickerOpen(false);
    setGoogleSpreadsheet(sheet.id);
    setSelectedSpreadsheetName(sheet.name);
    setGooglePreview(null);
    setGoogleWorksheet("");
    setWorksheets([]);
    setGoogleMessage(null);
    void fetchWorksheets(sheet.id);
  }

  function handleManualSpreadsheetChange(value: string) {
    setGoogleSpreadsheet(value);
    setGooglePreview(null);
    setWorksheets([]);
    setGoogleWorksheet("");
    if (manualUrlTimerRef.current) clearTimeout(manualUrlTimerRef.current);
    const trimmed = value.trim();
    if (!looksLikeSpreadsheetValue(trimmed)) return;
    manualUrlTimerRef.current = setTimeout(() => {
      void fetchWorksheets(trimmed);
    }, 500);
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

      const nextHref = getClevrSyncDatasetHref(payload);
      if (!nextHref) {
        throw new Error("Google Sheet synced, but UseClevr did not return an analysis destination.");
      }

      setGoogleMessage("Google Sheet synced");
      await loadConnectors();
      router.push(nextHref);
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
              Connect business data sources that feed UseClevr datasets. Local Excel and CSV files
              are uploaded through the normal UseClevr upload.
            </p>
          </div>
          {activeConnector ? (
            <span className="inline-flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              {connectorOptions.find((option) => option.type === activePanel)?.label} connected
            </span>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {connectorOptions.map((option) => {
          const Icon = option.icon;
          const available = true;
          const connector = connectors.find((item) => item.type === option.type) ?? null;
          const locked = accessLoaded && access?.enabled === false;
          const isActive = activePanel === option.type;
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
                    variant={connector ? "outline" : "secondary"}
                    className="w-full"
                    disabled={!access?.enabled}
                    onClick={() => setActivePanel(option.type)}
                  >
                    {option.type === "google_sheets" ? (
                      <Database className="mr-2 h-4 w-4" />
                    ) : option.type === "onedrive" ? (
                      <Cloud className="mr-2 h-4 w-4" />
                    ) : (
                      <Share2 className="mr-2 h-4 w-4" />
                    )}
                    {connector ? "Configure" : "Connect"}
                  </Button>
                )}
                {isActive && available ? (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    {connector ? "Connection configured below" : option.description}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </section>

      {activePanel === "google_sheets" ? (
        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Google Sheets</CardTitle>
                <CardDescription>
                  Choose one of your Google Sheets, preview a worksheet, and sync it into UseClevr
                  datasets.
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
                {reconnectHint ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                    <p className="text-sm text-amber-800 dark:text-amber-200">{reconnectHint}</p>
                    <Button type="button" variant="outline" onClick={handleGoogleConnect}>
                      Reconnect Google Sheets
                    </Button>
                  </div>
                ) : null}

                <div className="space-y-4 rounded-md border border-border bg-background/70 p-4">
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="space-y-1">
                      <label
                        htmlFor="clevrsync-spreadsheet-picker"
                        className="text-sm font-medium text-foreground"
                      >
                        Spreadsheet
                      </label>
                      <SpreadsheetPicker
                        id="clevrsync-spreadsheet-picker"
                        spreadsheets={spreadsheets}
                        isLoading={isListingSpreadsheets}
                        error={spreadsheetsError}
                        open={pickerOpen}
                        activeIndex={pickerActiveIndex}
                        hasMore={Boolean(nextPageToken)}
                        search={spreadsheetSearch}
                        selectedId={googleSpreadsheet}
                        selectedLabel={pickerLabel}
                        onOpenChange={(open) => {
                          setPickerOpen(open);
                          setPickerActiveIndex(0);
                        }}
                        onSearchChange={setSpreadsheetSearch}
                        onSelect={selectSpreadsheet}
                        onLoadMore={() => {
                          void loadSpreadsheets({ pageToken: nextPageToken, append: true });
                        }}
                        onActiveIndexChange={setPickerActiveIndex}
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="clevrsync-worksheet-select"
                        className="text-sm font-medium text-foreground"
                      >
                        Worksheet
                      </label>
                      <div className="relative">
                        <select
                          id="clevrsync-worksheet-select"
                          value={googleWorksheet}
                          onChange={(event) => {
                            setGoogleWorksheet(event.target.value);
                            setGooglePreview(null);
                          }}
                          className="h-11 w-full appearance-none rounded-md border border-input bg-background px-3 pr-9 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="">
                            {isListingWorksheets ? "Loading worksheets…" : "First worksheet"}
                          </option>
                          {worksheets.map((worksheet) => (
                            <option key={worksheet.title} value={worksheet.title}>
                              {worksheet.title}
                            </option>
                          ))}
                        </select>
                        {isListingWorksheets ? (
                          <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                        ) : (
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
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

                  <div className="space-y-2 border-t border-border pt-3">
                    <button
                      type="button"
                      className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      aria-expanded={manualEntryOpen}
                      onClick={() => setManualEntryOpen((open) => !open)}
                    >
                      {manualEntryOpen ? "Hide manual URL entry" : "Paste Sheet URL manually"}
                    </button>
                    {manualEntryOpen ? (
                      <input
                        type="text"
                        value={googleSpreadsheet}
                        onChange={(event) => handleManualSpreadsheetChange(event.target.value)}
                        placeholder="Google Sheets URL or spreadsheet ID"
                        aria-label="Google Sheets URL or spreadsheet ID"
                        className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    ) : null}
                  </div>
                </div>
                {access?.enabled === false ? <PremiumLock access={access} /> : null}

                {googleMessage ? (
                  <p className="text-sm text-muted-foreground">{googleMessage}</p>
                ) : null}
                <div className="space-y-1 text-sm text-muted-foreground">
                  {selectedGoogleConnector.sourceMeta?.datasetId ? (
                    <p>
                      Linked sheet: {pickerLabel}
                      {googleWorksheet ? ` · Worksheet: ${googleWorksheet}` : ""}
                    </p>
                  ) : null}
                  {selectedGoogleConnector.sourceMeta?.lastSuccessfulSync ? (
                    <p>
                      Last synced{" "}
                      {new Date(
                        String(selectedGoogleConnector.sourceMeta.lastSuccessfulSync),
                      ).toLocaleString()}
                    </p>
                  ) : null}
                </div>

                {googlePreview ? <PreviewTable preview={googlePreview} /> : null}
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {activePanel === "onedrive" || activePanel === "sharepoint" ? (
        <MicrosoftConnectorPanel
          key={activePanel}
          connectorType={activePanel}
          connector={
            connectors.find((item) => item.type === activePanel) as
              | (Connector & { type: "onedrive" | "sharepoint" })
              | null
          }
          access={access}
          onConnectorsChanged={loadConnectors}
          onMessage={setGoogleMessage}
        />
      ) : null}
    </div>
  );
}

function MicrosoftConnectorPanel({
  connectorType,
  connector,
  access,
  onConnectorsChanged,
  onMessage,
}: {
  connectorType: "onedrive" | "sharepoint";
  connector: (Connector & { type: "onedrive" | "sharepoint" }) | null;
  access: ClevrSyncAccess | null;
  onConnectorsChanged: () => Promise<void>;
  onMessage: (message: string | null) => void;
}) {
  const label = connectorType === "onedrive" ? "OneDrive" : "SharePoint";
  const sourceMeta = connector?.sourceMeta ?? {};
  const initializedRef = useRef<string | null>(null);

  const [reconnectHint, setReconnectHint] = useState<string | null>(null);
  const [permissionHint, setPermissionHint] = useState<string | null>(null);
  const [preview, setPreview] = useState<ClevrSyncPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // SharePoint discovery state
  const [sites, setSites] = useState<MicrosoftSiteSummary[]>([]);
  const [siteSearch, setSiteSearch] = useState("");
  const [isSearchingSites, setIsSearchingSites] = useState(false);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [sitesSearched, setSitesSearched] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedSiteName, setSelectedSiteName] = useState<string | null>(null);
  const [drives, setDrives] = useState<MicrosoftDriveSummary[]>([]);
  const [selectedDriveId, setSelectedDriveId] = useState("");
  const [selectedDriveName, setSelectedDriveName] = useState<string | null>(null);
  const [isListingDrives, setIsListingDrives] = useState(false);

  // Workbook discovery state (OneDrive + SharePoint)
  const [workbooks, setWorkbooks] = useState<MicrosoftWorkbookSummary[]>([]);
  const [workbookSearch, setWorkbookSearch] = useState("");
  const [isListingWorkbooks, setIsListingWorkbooks] = useState(false);
  const [workbooksError, setWorkbooksError] = useState<string | null>(null);
  const [workbookPickerOpen, setWorkbookPickerOpen] = useState(false);
  const [workbookActiveIndex, setWorkbookActiveIndex] = useState(0);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [selectedWorkbookItemId, setSelectedWorkbookItemId] = useState("");
  const [selectedWorkbookName, setSelectedWorkbookName] = useState<string | null>(null);
  const [selectedWorkbookDriveId, setSelectedWorkbookDriveId] = useState("");

  // Worksheet state
  const [worksheets, setWorksheets] = useState<MicrosoftWorksheetSummary[]>([]);
  const [isListingWorksheets, setIsListingWorksheets] = useState(false);
  const [worksheetId, setWorksheetId] = useState("");

  const canPickWorkbooks = connectorType === "onedrive" || Boolean(selectedDriveId);
  const canPreview = Boolean(connector && selectedWorkbookItemId && worksheetId);

  useEffect(() => {
    if (!connector?.id) return;
    if (initializedRef.current === connector.id) return;
    initializedRef.current = connector.id;
    // Restore the persisted source selection after reconnects.
    const linkedItemId = readMetaString(sourceMeta.itemId);
    if (linkedItemId) {
      setSelectedWorkbookItemId(linkedItemId);
      setSelectedWorkbookName(
        readMetaString(sourceMeta.workbookName) || "Selected workbook",
      );
      setSelectedWorkbookDriveId(readMetaString(sourceMeta.driveId) || "");
      const linkedWorksheetId = readMetaString(sourceMeta.worksheetId);
      const linkedWorksheetName = readMetaString(sourceMeta.worksheetName);
      if (linkedWorksheetName) {
        setWorksheets([
          { id: linkedWorksheetId || linkedWorksheetName, name: linkedWorksheetName, position: 0 },
        ]);
      }
      setWorksheetId(linkedWorksheetId || "");
      if (connectorType === "sharepoint") {
        setSelectedSiteId(readMetaString(sourceMeta.siteId) || "");
        setSelectedSiteName(readMetaString(sourceMeta.siteName));
        setSelectedDriveId(readMetaString(sourceMeta.driveId) || "");
        setSelectedDriveName(readMetaString(sourceMeta.driveName));
      }
    }
  }, [connector?.id]);

  useEffect(() => {
    if (!workbookPickerOpen) return;
    const handle = setTimeout(() => {
      void loadWorkbooks({ search: workbookSearch.trim() || null, append: false });
    }, 300);
    return () => clearTimeout(handle);
  }, [workbookSearch, workbookPickerOpen]);

  function handleMicrosoftConnect() {
    if (!access?.enabled) return;
    window.location.href = `/api/clevrsync/microsoft/oauth/start?connector=${connectorType}&returnTo=/app/settings/data-connections`;
  }

  async function searchSites() {
    if (!access?.enabled || !connector) return;
    setIsSearchingSites(true);
    setSitesError(null);
    try {
      const params = new URLSearchParams({ connectorId: connector.id });
      if (siteSearch.trim()) params.set("search", siteSearch.trim());
      const response = await fetch(`/api/clevrsync/microsoft/sharepoint/sites?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setSites([]);
        if (response.status === 401) {
          setReconnectHint(payload?.error || "Reconnect Microsoft to browse your SharePoint sites.");
          if (payload?.scopeUpgradeRequired) setPermissionHint(payload?.error || null);
        } else {
          setSitesError(payload?.error || "Unable to search SharePoint sites");
        }
        return;
      }
      setSites(Array.isArray(payload?.sites) ? payload.sites : []);
      setSitesSearched(true);
      setReconnectHint(null);
      setPermissionHint(null);
    } catch (error) {
      setSitesError(error instanceof Error ? error.message : "Unable to search SharePoint sites");
    } finally {
      setIsSearchingSites(false);
    }
  }

  async function selectSite(site: MicrosoftSiteSummary) {
    if (!connector) return;
    setSelectedSiteId(site.id);
    setSelectedSiteName(site.displayName);
    setDrives([]);
    setSelectedDriveId("");
    setSelectedDriveName(null);
    setWorkbooks([]);
    setSelectedWorkbookItemId("");
    setSelectedWorkbookName(null);
    setPreview(null);
    setWorksheets([]);
    setWorksheetId("");
    setIsListingDrives(true);
    setSitesError(null);
    try {
      const params = new URLSearchParams({ connectorId: connector.id, siteId: site.id });
      const response = await fetch(`/api/clevrsync/microsoft/sharepoint/drives?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setDrives([]);
        setSitesError(payload?.error || "Unable to load document libraries");
        return;
      }
      const list: MicrosoftDriveSummary[] = Array.isArray(payload?.drives) ? payload.drives : [];
      setDrives(list);
    } catch (error) {
      setSitesError(error instanceof Error ? error.message : "Unable to load document libraries");
    } finally {
      setIsListingDrives(false);
    }
  }

  function selectDrive(drive: MicrosoftDriveSummary) {
    setSelectedDriveId(drive.id);
    setSelectedDriveName(drive.name);
    setWorkbooks([]);
    setSelectedWorkbookItemId("");
    setSelectedWorkbookName(null);
    setPreview(null);
    setWorksheets([]);
    setWorksheetId("");
    void loadWorkbooks({ driveId: drive.id, search: null, append: false });
  }

  async function loadWorkbooks(options?: {
    driveId?: string;
    search?: string | null;
    pageToken?: string | null;
    append?: boolean;
  }) {
    if (!access?.enabled || !connector) return;
    const driveId = options?.driveId || selectedDriveId;
    if (connectorType === "sharepoint" && !driveId) return;
    if (!options?.append) {
      setIsListingWorkbooks(true);
      setWorkbooksError(null);
    }
    setReconnectHint(null);

    try {
      const params = new URLSearchParams({ connectorId: connector.id });
      const search = options?.search;
      if (search) params.set("search", search);
      if (options?.pageToken) params.set("pageToken", options.pageToken);
      if (connectorType === "sharepoint") params.set("driveId", driveId);
      const endpoint =
        connectorType === "onedrive"
          ? "/api/clevrsync/microsoft/onedrive/files"
          : "/api/clevrsync/microsoft/sharepoint/files";
      const response = await fetch(`${endpoint}?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (!options?.append) setWorkbooks([]);
        if (response.status === 401) {
          setReconnectHint(payload?.error || "Reconnect Microsoft to browse your workbooks.");
          if (payload?.scopeUpgradeRequired) setPermissionHint(payload?.error || null);
        } else {
          setWorkbooksError(payload?.error || "Unable to list workbooks");
        }
        return;
      }
      const list: MicrosoftWorkbookSummary[] = Array.isArray(payload?.workbooks) ? payload.workbooks : [];
      setWorkbooks((current) => (options?.append ? [...current, ...list] : list));
      setNextPageToken(typeof payload?.nextPageToken === "string" ? payload.nextPageToken : null);
      setReconnectHint(null);
      setPermissionHint(null);
    } catch (error) {
      setWorkbooksError(error instanceof Error ? error.message : "Unable to list workbooks");
    } finally {
      setIsListingWorkbooks(false);
    }
  }

  async function selectWorkbook(workbook: MicrosoftWorkbookSummary) {
    if (!connector) return;
    setWorkbookPickerOpen(false);
    setSelectedWorkbookItemId(workbook.itemId);
    setSelectedWorkbookName(workbook.name);
    setSelectedWorkbookDriveId(workbook.driveId || "");
    setPreview(null);
    setWorksheets([]);
    setWorksheetId("");

    const params = new URLSearchParams({
      connectorId: connector.id,
      connectorType,
      itemId: workbook.itemId,
    });
    if (workbook.driveId) params.set("driveId", workbook.driveId);
    setIsListingWorksheets(true);
    try {
      const response = await fetch(`/api/clevrsync/microsoft/worksheets?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setWorksheets([]);
        if (response.status === 401) {
          setReconnectHint(payload?.error || "Reconnect Microsoft");
        } else {
          onMessage(payload?.error || "Unable to load worksheets");
        }
        return;
      }
      const list: MicrosoftWorksheetSummary[] = Array.isArray(payload?.worksheets) ? payload.worksheets : [];
      setWorksheets(list);
      if (typeof payload?.workbookName === "string" && payload.workbookName) {
        setSelectedWorkbookName(payload.workbookName);
      }
      setWorksheetId(list[0]?.id || "");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Unable to load worksheets");
    } finally {
      setIsListingWorksheets(false);
    }
  }

  async function handlePreview() {
    if (!connector || !canPreview) return;
    setIsPreviewing(true);
    onMessage(null);
    try {
      const response = await fetch("/api/clevrsync/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorId: connector.id,
          connectorType,
          itemId: selectedWorkbookItemId,
          driveId: selectedWorkbookDriveId || null,
          siteId: selectedSiteId || null,
          siteName: selectedSiteName || null,
          driveName: selectedDriveName || null,
          worksheetId: worksheetId || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to preview workbook");
      setPreview(payload.preview);
      if (payload.preview?.microsoft?.worksheetId) {
        setWorksheetId(payload.preview.microsoft.worksheetId);
      }
      onMessage(`${label} preview ready`);
      await onConnectorsChanged();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Unable to preview workbook");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleSync() {
    if (!connector || !selectedWorkbookItemId) return;
    setIsSyncing(true);
    onMessage(null);
    try {
      const response = await fetch("/api/clevrsync/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorId: connector.id,
          connectorType,
          itemId: selectedWorkbookItemId,
          driveId: selectedWorkbookDriveId || null,
          siteId: selectedSiteId || null,
          siteName: selectedSiteName || null,
          driveName: selectedDriveName || null,
          worksheetId: worksheetId || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.upload?.error || payload.error || `Unable to sync ${label}`);

      const nextHref = getClevrSyncDatasetHref(payload);
      if (!nextHref) {
        throw new Error(`${label} synced, but UseClevr did not return an analysis destination.`);
      }
      onMessage(`${label} synced`);
      await onConnectorsChanged();
      window.location.href = nextHref;
    } catch (error) {
      onMessage(error instanceof Error ? error.message : `Unable to sync ${label}`);
    } finally {
      setIsSyncing(false);
    }
  }

  const workbookPickerLabel =
    workbooks.find((workbook) => workbook.itemId === selectedWorkbookItemId)?.name ||
    selectedWorkbookName ||
    (selectedWorkbookItemId ? "Selected workbook" : "Choose Excel workbook");

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{label}</CardTitle>
            <CardDescription>
              {connectorType === "onedrive"
                ? "Choose an Excel workbook from your OneDrive, preview a worksheet, and sync it into UseClevr datasets."
                : "Choose a SharePoint site and document library, preview a worksheet, and sync it into UseClevr datasets."}
            </CardDescription>
          </div>
          <ConnectionBadge connector={connector} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connector ? (
          access?.enabled === false ? (
            <PremiumLock access={access} />
          ) : (
            <Button type="button" onClick={handleMicrosoftConnect}>
              <Cloud className="mr-2 h-4 w-4" />
              Connect Microsoft for {label}
            </Button>
          )
        ) : (
          <>
            {reconnectHint ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-sm text-amber-800 dark:text-amber-200">{reconnectHint}</p>
                <Button type="button" variant="outline" onClick={handleMicrosoftConnect}>
                  Reconnect Microsoft
                </Button>
              </div>
            ) : null}
            {permissionHint ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Additional Microsoft permission required: {permissionHint}
                </p>
                <Button type="button" variant="outline" onClick={handleMicrosoftConnect}>
                  Grant permission
                </Button>
              </div>
            ) : null}

            <div className="space-y-4 rounded-md border border-border bg-background/70 p-4">
              {connectorType === "sharepoint" ? (
                <>
                  <div className="space-y-1">
                    <label htmlFor="clevrsync-site-search" className="text-sm font-medium text-foreground">
                      SharePoint site
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="clevrsync-site-search"
                        type="text"
                        value={siteSearch}
                        onChange={(event) => setSiteSearch(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void searchSites();
                          }
                        }}
                        placeholder="Search sites by name"
                        className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void searchSites()}
                        disabled={!access?.enabled || isSearchingSites}
                      >
                        {isSearchingSites ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Search"
                        )}
                      </Button>
                    </div>
                    {sitesError ? (
                      <p className="text-sm text-red-600 dark:text-red-400">{sitesError}</p>
                    ) : null}
                    {sitesSearched && !isSearchingSites && sites.length === 0 && !sitesError ? (
                      <p className="text-sm text-muted-foreground">
                        No SharePoint sites found for this search.
                      </p>
                    ) : null}
                    {sites.length > 0 ? (
                      <select
                        aria-label="SharePoint site"
                        value={selectedSiteId}
                        onChange={(event) => {
                          const site = sites.find((item) => item.id === event.target.value);
                          if (site) void selectSite(site);
                        }}
                        className="h-11 w-full appearance-none rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">Choose site</option>
                        {sites.map((site) => (
                          <option key={site.id} value={site.id}>
                            {site.displayName}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="clevrsync-drive-select" className="text-sm font-medium text-foreground">
                      Document library
                    </label>
                    <div className="relative">
                      <select
                        id="clevrsync-drive-select"
                        value={selectedDriveId}
                        onChange={(event) => {
                          const drive = drives.find((item) => item.id === event.target.value);
                          if (drive) selectDrive(drive);
                        }}
                        disabled={drives.length === 0}
                        className="h-11 w-full appearance-none rounded-md border border-input bg-background px-3 pr-9 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                      >
                        <option value="">
                          {isListingDrives ? "Loading document libraries…" : "Choose document library"}
                        </option>
                        {drives.map((drive) => (
                          <option key={drive.id} value={drive.id}>
                            {drive.name}
                          </option>
                        ))}
                      </select>
                      {isListingDrives ? (
                        <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                      ) : (
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </>
              ) : null}

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-1">
                  <label
                    htmlFor="clevrsync-workbook-picker"
                    className="text-sm font-medium text-foreground"
                  >
                    Excel workbook
                  </label>
                  <ResourcePicker
                    id="clevrsync-workbook-picker"
                    items={workbooks.map((workbook) => ({
                      id: workbook.itemId,
                      name: workbook.name,
                      meta: formatWorkbookMeta(workbook),
                    }))}
                    isLoading={isListingWorkbooks}
                    error={workbooksError}
                    open={workbookPickerOpen}
                    activeIndex={workbookActiveIndex}
                    hasMore={Boolean(nextPageToken)}
                    search={workbookSearch}
                    selectedId={selectedWorkbookItemId}
                    selectedLabel={workbookPickerLabel}
                    searchPlaceholder="Search workbooks..."
                    listLabel="Workbooks"
                    emptyMessage={
                      connectorType === "onedrive"
                        ? "No Excel workbooks found. Try another search."
                        : "No Excel workbooks found in this document library."
                    }
                    disabled={!canPickWorkbooks}
                    onOpenChange={(open) => {
                      setWorkbookPickerOpen(open);
                      setWorkbookActiveIndex(0);
                    }}
                    onSearchChange={setWorkbookSearch}
                    onSelect={(item) => {
                      const workbook = workbooks.find((entry) => entry.itemId === item.id);
                      if (workbook) void selectWorkbook(workbook);
                    }}
                    onLoadMore={() => {
                      void loadWorkbooks({ pageToken: nextPageToken, append: true });
                    }}
                    onActiveIndexChange={setWorkbookActiveIndex}
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="clevrsync-ms-worksheet-select"
                    className="text-sm font-medium text-foreground"
                  >
                    Worksheet
                  </label>
                  <div className="relative">
                    <select
                      id="clevrsync-ms-worksheet-select"
                      value={worksheetId}
                      onChange={(event) => {
                        setWorksheetId(event.target.value);
                        setPreview(null);
                      }}
                      className="h-11 w-full appearance-none rounded-md border border-input bg-background px-3 pr-9 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">
                        {isListingWorksheets ? "Loading worksheets…" : "First worksheet"}
                      </option>
                      {worksheets.map((worksheet) => (
                        <option key={worksheet.id} value={worksheet.id}>
                          {worksheet.name}
                        </option>
                      ))}
                    </select>
                    {isListingWorksheets ? (
                      <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    ) : (
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
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
                  disabled={!access?.enabled || !selectedWorkbookItemId || isSyncing}
                >
                  {isSyncing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="mr-2 h-4 w-4" />
                  )}
                  {sourceMeta?.datasetId ? "Sync now" : "Connect & Analyze"}
                </Button>
              </div>
            </div>

            <div className="space-y-1 text-sm text-muted-foreground">
              {sourceMeta?.datasetId ? (
                <p>
                  Linked workbook: {workbookPickerLabel}
                  {readMetaString(sourceMeta.worksheetName)
                    ? ` · Worksheet: ${readMetaString(sourceMeta.worksheetName)}`
                    : ""}
                </p>
              ) : null}
              {readMetaString(sourceMeta.folderPath) ? (
                <p>Folder: {readMetaString(sourceMeta.folderPath)}</p>
              ) : null}
              {connectorType === "sharepoint" && readMetaString(sourceMeta.siteName) ? (
                <p>Site: {readMetaString(sourceMeta.siteName)}</p>
              ) : null}
              {sourceMeta?.lastSuccessfulSync ? (
                <p>
                  Last synced {new Date(String(sourceMeta.lastSuccessfulSync)).toLocaleString()}
                </p>
              ) : null}
            </div>

            {preview ? <PreviewTable preview={preview} /> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function looksLikeSpreadsheetValue(value: string) {
  if (value.includes("/spreadsheets/d/")) return true;
  return /^[a-zA-Z0-9-_]{20,}$/.test(value);
}

function readMetaString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatWorkbookMeta(workbook: MicrosoftWorkbookSummary) {
  const parts: string[] = [];
  if (workbook.folderPath) parts.push(workbook.folderPath);
  if (workbook.lastModified) {
    const date = new Date(workbook.lastModified);
    if (!Number.isNaN(date.getTime())) parts.push(`Modified ${date.toLocaleDateString()}`);
  }
  return parts.join(" · ");
}

function formatSpreadsheetMeta(sheet: SpreadsheetSummary) {
  const parts: string[] = [];
  if (sheet.modifiedTime) {
    const date = new Date(sheet.modifiedTime);
    if (!Number.isNaN(date.getTime())) parts.push(`Modified ${date.toLocaleDateString()}`);
  }
  if (sheet.shared) parts.push("Shared with me");
  return parts.join(" · ");
}

function getClevrSyncDatasetHref(payload: ClevrSyncSyncPayload) {
  const directHref =
    readSyncString(payload.redirectTo) ||
    readSyncString(payload.redirectUrl) ||
    readSyncString(payload.upload?.redirectTo) ||
    readSyncString(payload.upload?.redirectUrl);
  if (directHref?.startsWith("/app/")) {
    return directHref;
  }

  const datasetId = readSyncString(payload.datasetId) || readSyncString(payload.upload?.datasetId);
  return datasetId ? `/app/dashboard?datasetId=${encodeURIComponent(datasetId)}` : null;
}

function readSyncString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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
    <span className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground">
      {label}
    </span>
  );
}

function PremiumLock({ access }: { access: ClevrSyncAccess }) {
  return (
    <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">ClevrSync requires Pro or Business</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Free users can upload CSV and XLSX files directly through the Datasets page. Upgrade to
            sync cloud data sources like Google Sheets, OneDrive, and SharePoint.
          </p>
        </div>
        <Link href={access.upgradeHref}>
          <Button type="button">Upgrade to Pro</Button>
        </Link>
      </div>
    </div>
  );
}

function SpreadsheetPicker(props: {
  id: string;
  spreadsheets: SpreadsheetSummary[];
  isLoading: boolean;
  error: string | null;
  open: boolean;
  activeIndex: number;
  hasMore: boolean;
  search: string;
  selectedId: string;
  selectedLabel: string;
  onOpenChange: (open: boolean) => void;
  onSearchChange: (value: string) => void;
  onSelect: (sheet: SpreadsheetSummary) => void;
  onLoadMore: () => void;
  onActiveIndexChange: (index: number) => void;
}) {
  return (
    <ResourcePicker
      id={props.id}
      items={props.spreadsheets.map((sheet) => ({
        id: sheet.id,
        name: sheet.name,
        meta: formatSpreadsheetMeta(sheet),
      }))}
      isLoading={props.isLoading}
      error={props.error}
      open={props.open}
      activeIndex={props.activeIndex}
      hasMore={props.hasMore}
      search={props.search}
      selectedId={props.selectedId}
      selectedLabel={props.selectedLabel}
      searchPlaceholder="Search spreadsheets..."
      listLabel="Spreadsheets"
      emptyMessage="No spreadsheets found. Try another search or paste a Sheet URL manually."
      onOpenChange={props.onOpenChange}
      onSearchChange={props.onSearchChange}
      onSelect={(item) => {
        const sheet = props.spreadsheets.find((entry) => entry.id === item.id);
        if (sheet) props.onSelect(sheet);
      }}
      onLoadMore={props.onLoadMore}
      onActiveIndexChange={props.onActiveIndexChange}
    />
  );
}

function ResourcePicker(props: {
  id: string;
  items: ResourceItem[];
  isLoading: boolean;
  error: string | null;
  open: boolean;
  activeIndex: number;
  hasMore: boolean;
  search: string;
  selectedId: string;
  selectedLabel: string;
  searchPlaceholder: string;
  listLabel: string;
  emptyMessage: string;
  disabled?: boolean;
  onOpenChange: (open: boolean) => void;
  onSearchChange: (value: string) => void;
  onSelect: (item: ResourceItem) => void;
  onLoadMore: () => void;
  onActiveIndexChange: (index: number) => void;
}) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (props.open) searchInputRef.current?.focus();
  }, [props.open]);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      props.onActiveIndexChange(Math.min(props.activeIndex + 1, Math.max(props.items.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      props.onActiveIndexChange(Math.max(props.activeIndex - 1, 0));
    } else if (event.key === "Enter") {
      const item = props.items[props.activeIndex];
      if (item) {
        event.preventDefault();
        props.onSelect(item);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      props.onOpenChange(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        id={props.id}
        role="combobox"
        aria-expanded={props.open}
        aria-haspopup="listbox"
        aria-controls={`${props.id}-listbox`}
        disabled={props.disabled}
        onClick={() => props.onOpenChange(!props.open)}
        onKeyDown={(event) => {
          if (!props.open && (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            props.onOpenChange(true);
          }
        }}
        className="flex h-11 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        <span className="truncate">{props.selectedLabel}</span>
        {props.isLoading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {props.open ? (
        <>
          <div className="fixed inset-0 z-20" onClick={() => props.onOpenChange(false)} aria-hidden="true" />
          <div className="absolute z-30 mt-1 w-full rounded-md border border-border bg-background shadow-lg">
            <div className="border-b border-border p-2">
              <input
                ref={searchInputRef}
                type="text"
                role="combobox"
                aria-expanded={props.open}
                aria-controls={`${props.id}-listbox`}
                aria-autocomplete="list"
                value={props.search}
                onChange={(event) => props.onSearchChange(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={props.searchPlaceholder}
                aria-label={props.searchPlaceholder.trim()}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div
              id={`${props.id}-listbox`}
              role="listbox"
              aria-label={props.listLabel}
              className="max-h-64 overflow-y-auto"
            >
              {props.isLoading && props.items.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">Loading…</p>
              ) : null}
              {!props.isLoading && props.items.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">{props.emptyMessage}</p>
              ) : null}
              {props.items.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={item.id === props.selectedId}
                  onMouseEnter={() => props.onActiveIndexChange(index)}
                  onClick={() => props.onSelect(item)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${index === props.activeIndex ? "bg-muted" : ""}`}
                >
                  <span className="block truncate font-medium text-foreground">{item.name}</span>
                  <span className="block text-xs text-muted-foreground">{item.meta}</span>
                </button>
              ))}
            </div>
            {props.hasMore ? (
              <div className="border-t border-border p-2">
                <Button type="button" variant="outline" className="w-full" onClick={props.onLoadMore}>
                  Load more
                </Button>
              </div>
            ) : null}
            {props.error ? (
              <p className="border-t border-border px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {props.error}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
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
