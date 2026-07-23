"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  Link as LinkIcon,
  Loader2,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Store,
  Square,
  Unplug,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const comingSoonProviders = [
  { name: "Shopify", description: "Online and retail POS sync for orders, products, and stock." },
  { name: "Clover", description: "Counter-service and retail POS sync for catalog and sales data." },
  { name: "Lightspeed", description: "Specialty retail sync for locations, inventory, and sales history." },
];

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
            Retail POS Connections
          </CardTitle>
          <CardDescription>
            Connect point-of-sale systems or keep using CSV and Excel uploads below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading integrations
            </div>
          ) : (
            <>
              <SquareConnectorCard
                connection={squareConnection}
                busyAction={busyAction}
                onConnect={connectSquare}
                onSync={syncNow}
                onDisconnect={setDisconnectTarget}
              />

              <div className="grid gap-3 md:grid-cols-3">
                {comingSoonProviders.map((provider) => (
                  <ComingSoonCard key={provider.name} {...provider} />
                ))}
              </div>
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

function SquareConnectorCard({
  connection,
  busyAction,
  onConnect,
  onSync,
  onDisconnect,
}: {
  connection?: RetailConnection;
  busyAction: string | null;
  onConnect: () => void;
  onSync: (connectionId: string) => void;
  onDisconnect: (connection: RetailConnection) => void;
}) {
  const isConnected = Boolean(connection && connection.connectionStatus !== "disconnected");

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-background shadow-sm">
            <Square className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">Square</h3>
              <StatusPill status={connection?.connectionStatus || "not_connected"} />
            </div>
            <p className="text-sm text-muted-foreground">
              Import locations, products, inventory, and orders from Square.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {connection ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onSync(connection.id)}
                disabled={busyAction === `sync-${connection.id}` || !isConnected}
              >
                {busyAction === `sync-${connection.id}` ? (
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
                onClick={onConnect}
                disabled={busyAction === "connect-square"}
              >
                {busyAction === "connect-square" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LinkIcon className="mr-2 h-4 w-4" />
                )}
                {isConnected ? "Reconnect" : "Connect"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => onDisconnect(connection)}
                disabled={busyAction === `disconnect-${connection.id}` || !isConnected}
              >
                <Unplug className="mr-2 h-4 w-4" />
                Disconnect
              </Button>
            </>
          ) : (
            <Button type="button" onClick={onConnect} disabled={busyAction === "connect-square"}>
              {busyAction === "connect-square" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LinkIcon className="mr-2 h-4 w-4" />
              )}
              Connect
            </Button>
          )}
        </div>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Connection status" value={formatStatusText(connection?.connectionStatus || "not_connected")} />
        <Metric label="Merchant name" value={getMerchantName(connection)} />
        <Metric label="Locations" value={connection?.counts.locations ?? 0} />
        <Metric label="Products" value={connection?.counts.products ?? 0} />
        <Metric label="Last sync" value={formatDate(connection?.lastSuccessfulSyncAt || null)} />
      </dl>

      {connection?.connectionError ? (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{connection.connectionError}</span>
        </div>
      ) : null}

      {connection ? <ConnectionDetails connection={connection} /> : null}
    </div>
  );
}

function ConnectionDetails({ connection }: { connection: RetailConnection }) {
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <div className="rounded-lg border bg-background p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="h-4 w-4" />
          Imported records
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
      <div className="rounded-lg border bg-background p-4">
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

function ComingSoonCard({ name, description }: { name: string; description: string }) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border bg-muted/40 p-4 opacity-75">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-background">
          {name === "Shopify" ? (
            <ShoppingBag className="h-5 w-5" />
          ) : name === "Clover" ? (
            <Store className="h-5 w-5" />
          ) : (
            <Database className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{name}</h3>
            <StatusPill status="coming_soon" />
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" disabled className="mt-auto w-fit">
        <Clock className="mr-2 h-4 w-4" />
        Coming soon
      </Button>
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

function getMerchantName(connection?: RetailConnection) {
  if (!connection) return "Not connected";
  if (connection.displayName && connection.displayName !== "Square") return connection.displayName;
  return connection.externalMerchantId || connection.displayName || "Square";
}

function formatStatusText(status: string) {
  return status.replaceAll("_", " ");
}

function formatDate(value: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
