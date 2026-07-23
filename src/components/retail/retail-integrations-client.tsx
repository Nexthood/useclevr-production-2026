"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Link as LinkIcon,
  Loader2,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Square,
  Unplug,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type RetailConnection = {
  id: string;
  provider: string;
  displayName: string;
  connectionStatus: string;
  externalMerchantId: string | null;
  lastSuccessfulSyncAt: string | null;
  lastSyncAttemptAt: string | null;
  lastWebhookAt: string | null;
  connectionError: string | null;
  counts: {
    locations: number;
    products: number;
    variants: number;
    orders: number;
    failedWebhookEvents: number;
  };
  recentSyncRuns: Array<{
    id: string | null;
    status: string | null;
    syncType: string | null;
    createdAt: string | null;
  }>;
};

type IntegrationsResponse = {
  connections: RetailConnection[];
};

export function RetailIntegrationsClient() {
  const [connections, setConnections] = useState<RetailConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<RetailConnection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/integrations/retail", { cache: "no-store" });
      const payload = (await response.json()) as IntegrationsResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Retail integrations failed to load.");
      setConnections(payload.connections || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retail integrations failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function connectSquare() {
    setBusyAction("connect-square");
    setError(null);
    try {
      const response = await fetch("/api/integrations/retail/square/connect", { method: "POST" });
      const payload = (await response.json()) as { authorizationUrl?: string; error?: string };
      if (!response.ok || !payload.authorizationUrl) {
        throw new Error(payload.error || "Square connection could not start.");
      }
      window.location.href = payload.authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Square connection could not start.");
      setBusyAction(null);
    }
  }

  async function syncNow(connectionId: string) {
    setBusyAction(`sync-${connectionId}`);
    setError(null);
    try {
      const response = await fetch(`/api/integrations/retail/${connectionId}/sync`, { method: "POST" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Sync could not be queued.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync could not be queued.");
    } finally {
      setBusyAction(null);
    }
  }

  async function disconnect(connectionId: string) {
    setBusyAction(`disconnect-${connectionId}`);
    setError(null);
    try {
      const response = await fetch(`/api/integrations/retail/${connectionId}/disconnect`, {
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Square could not be disconnected.");
      setDisconnectTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Square could not be disconnected.");
    } finally {
      setBusyAction(null);
    }
  }

  const squareConnection = connections.find((connection) => connection.provider === "square");

  return (
    <div className="space-y-6">
      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlugZap className="h-5 w-5" />
            Connect Your Retail System
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading integrations
            </div>
          ) : (
            <>
              <ProviderRow
                icon={<Square className="h-5 w-5" />}
                name="Square"
                status={squareConnection?.connectionStatus || "not_connected"}
                description={squareConnection?.externalMerchantId || "Import locations, catalog, inventory, and orders."}
                action={
                  squareConnection ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => syncNow(squareConnection.id)}
                        disabled={busyAction === `sync-${squareConnection.id}` || squareConnection.connectionStatus === "disconnected"}
                      >
                        {busyAction === `sync-${squareConnection.id}` ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Sync now
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={connectSquare}
                        disabled={busyAction === "connect-square"}
                      >
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Reconnect
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setDisconnectTarget(squareConnection)}
                        disabled={busyAction === `disconnect-${squareConnection.id}`}
                      >
                        <Unplug className="mr-2 h-4 w-4" />
                        Disconnect
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" onClick={connectSquare} disabled={busyAction === "connect-square"}>
                      {busyAction === "connect-square" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <LinkIcon className="mr-2 h-4 w-4" />
                      )}
                      Connect
                    </Button>
                  )
                }
              />

              {squareConnection ? <ConnectionDetails connection={squareConnection} /> : null}

              <ProviderRow name="Shopify POS" status="coming_soon" description="Coming soon" />
              <ProviderRow name="Lightspeed Retail" status="coming_soon" description="Coming soon" />
              <ProviderRow name="Clover" status="coming_soon" description="Coming soon" />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(disconnectTarget)} onOpenChange={(open) => !open && setDisconnectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Square?</DialogTitle>
            <DialogDescription>
              Square syncs and new webhook processing stop. Imported analytics data stays available until you delete it separately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDisconnectTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => disconnectTarget && disconnect(disconnectTarget.id)}
              disabled={Boolean(disconnectTarget && busyAction === `disconnect-${disconnectTarget.id}`)}
            >
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProviderRow(props: {
  icon?: React.ReactNode;
  name: string;
  status: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
          {props.icon || <Clock className="h-5 w-5" />}
        </div>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{props.name}</h3>
            <StatusPill status={props.status} />
          </div>
          <p className="text-sm text-muted-foreground">{props.description}</p>
        </div>
      </div>
      {props.action ? <div>{props.action}</div> : null}
    </div>
  );
}

function ConnectionDetails({ connection }: { connection: RetailConnection }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-lg border p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="h-4 w-4" />
          Connection health
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Metric label="Locations" value={connection.counts.locations} />
          <Metric label="Products" value={connection.counts.products} />
          <Metric label="Variants" value={connection.counts.variants} />
          <Metric label="Orders" value={connection.counts.orders} />
          <Metric label="Last sync" value={formatDate(connection.lastSuccessfulSyncAt)} />
          <Metric label="Last webhook" value={formatDate(connection.lastWebhookAt)} />
        </dl>
        {connection.connectionError ? (
          <p className="mt-3 text-sm text-destructive">{connection.connectionError}</p>
        ) : null}
      </div>
      <div className="rounded-lg border p-4">
        <div className="mb-3 text-sm font-medium">Sync history</div>
        {connection.recentSyncRuns.length ? (
          <div className="space-y-2">
            {connection.recentSyncRuns.map((run) => (
              <div key={run.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="capitalize">{run.syncType || "sync"}</span>
                <span className="text-muted-foreground">{run.status || "queued"}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Waiting for first synchronization.</p>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const isGood = status === "active" || status === "connected";
  const isPending = status === "syncing" || status === "pending" || status === "queued";
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
        isGood
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : isPending
            ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "border-muted-foreground/30 bg-muted text-muted-foreground",
      ].join(" ")}
    >
      {isGood ? <CheckCircle2 className="h-3 w-3" /> : null}
      {status.replaceAll("_", " ")}
    </span>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
