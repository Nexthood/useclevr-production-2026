"use client";

import { AppPageHeader } from "@/components/layout/app-page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Clock,
  Copy,
  KeyRound,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";

const ALL_SCOPES = [
  "dataset:read",
  "dataset:write",
  "admin",
  "faq:read",
  "news:read",
] as const;

interface TokenRow {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  status: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export default function AdminMcpTokensPage() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCreatedDialog, setShowCreatedDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newScopes, setNewScopes] = useState<string[]>([]);
  const [newExpiry, setNewExpiry] = useState("90");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState("");
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadTokens();
  }, []);

  async function loadTokens() {
    try {
      setIsLoading(true);
      const res = await fetch("/api/mcp/tokens", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load tokens");
      const data = await res.json();
      setTokens(data.tokens || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load";
      setError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) {
      toast({ title: "Name required", description: "Please enter a token name.", variant: "destructive" });
      return;
    }
    if (newScopes.length === 0) {
      toast({ title: "Scopes required", description: "Select at least one scope.", variant: "destructive" });
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/mcp/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          scopes: newScopes,
          expiresInDays: Number(newExpiry) || 90,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create token");
      }

      const data = await res.json();
      setCreatedToken(data.token);
      setCreatedName(data.name);
      setShowCreateDialog(false);
      setShowCreatedDialog(true);
      setNewName("");
      setNewScopes([]);
      setNewExpiry("90");
      await loadTokens();
    } catch (err) {
      toast({
        title: "Error creating token",
        description: err instanceof Error ? err.message : "Failed to create",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRevoke(id: string, name: string) {
    if (!window.confirm(`Revoke token "${name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/mcp/tokens/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to revoke token");
      }
      setTokens((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: "revoked" } : t)),
      );
      toast({ title: "Token revoked", description: `"${name}" has been revoked.`, variant: "default" });
    } catch (err) {
      toast({
        title: "Error revoking token",
        description: err instanceof Error ? err.message : "Failed to revoke",
        variant: "destructive",
      });
    }
  }

  function handleCopy() {
    if (createdToken) {
      navigator.clipboard.writeText(createdToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function toggleScope(scope: string) {
    setNewScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  const activeTokens = tokens.filter((t) => t.status === "active").length;
  const expiredTokens = tokens.filter(
    (t) => t.status === "expired" || t.status === "revoked",
  ).length;
  const now = Date.now();
  const last30d = tokens.filter((t) => {
    const d = Date.parse(t.createdAt);
    return !isNaN(d) && now - d < 30 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="flex-1 bg-background">
      <AppPageHeader
        title="MCP Tokens"
        description="Manage API tokens for MCP service access."
        breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "MCP Tokens" }]}
        icon={KeyRound}
      />

      <main className="space-y-6 px-5 py-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            {
              label: "Total tokens",
              value: tokens.length,
              icon: KeyRound,
              color: "text-cyan-800 dark:text-cyan-100",
              bg: "bg-cyan-500/10",
            },
            {
              label: "Active",
              value: activeTokens,
              icon: Zap,
              color: "text-emerald-800 dark:text-emerald-100",
              bg: "bg-emerald-500/10",
            },
            {
              label: "Expired / Revoked",
              value: expiredTokens,
              icon: Trash2,
              color: "text-red-800 dark:text-red-100",
              bg: "bg-red-500/10",
            },
            {
              label: "Created (30d)",
              value: last30d,
              icon: Calendar,
              color: "text-purple-800 dark:text-purple-100",
              bg: "bg-purple-500/10",
            },
          ].map((stat) => (
            <Card key={stat.label} className="p-4 border-border bg-card">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {isLoading ? (
          <Card className="border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Loading…
          </Card>
        ) : error ? (
          <Card className="border-border bg-card p-8 text-center text-sm text-red-600 dark:text-red-400">
            {error}
          </Card>
        ) : (
          <DataTable
            title="Service tokens"
            description="Name, prefix, scopes, status, and activity."
            emptyMessage="No tokens found."
            rows={tokens as unknown as Record<string, unknown>[]}
            columns={columns(handleRevoke)}
            rowKey={(row) => String(row.id)}
            minWidth="min-w-[1000px]"
            selectable
            actions={
              <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create token
              </Button>
            }
          />
        )}
      </main>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create MCP token</DialogTitle>
            <DialogDescription>
              Generate a new API token with specific scope permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="token-name">Token name *</Label>
              <Input
                id="token-name"
                placeholder="e.g. Production integration"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Scopes *</Label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_SCOPES.map((scope) => (
                  <label
                    key={scope}
                    className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={newScopes.includes(scope)}
                      onChange={() => toggleScope(scope)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <span className="font-mono text-xs">{scope}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="token-expiry">Expires in (days)</Label>
              <Input
                id="token-expiry"
                type="number"
                min={1}
                max={365}
                value={newExpiry}
                onChange={(e) => setNewExpiry(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isCreating || !newName.trim() || newScopes.length === 0}>
              {isCreating ? "Creating…" : "Create token"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreatedDialog} onOpenChange={setShowCreatedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Token created</DialogTitle>
            <DialogDescription>
              Copy this token now — you won&apos;t be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Token &ldquo;{createdName}&rdquo; created successfully.
            </p>
            <div className="relative">
              <Input readOnly value={createdToken || ""} className="pr-12 font-mono text-xs" />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-8 px-2"
                onClick={handleCopy}
              >
                <Copy className="h-4 w-4" />
                <span className="ml-1 text-xs">{copied ? "Copied!" : "Copy"}</span>
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowCreatedDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function columns(
  onRevoke: (id: string, name: string) => void,
): DataTableColumn<Record<string, unknown>>[] {
  return [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{String(row.name)}</p>
          <p className="font-mono text-xs text-muted-foreground">{String(row.tokenPrefix)}…</p>
        </div>
      ),
    },
    {
      key: "scopes",
      header: "Scopes",
      render: (row) => {
        const scopes = row.scopes as string[];
        return (
          <div className="flex flex-wrap gap-1">
            {scopes.map((s) => (
              <span
                key={s}
                className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary"
              >
                {s}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (row) => {
        const status = String(row.status);
        const colors: Record<string, string> = {
          active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
          revoked: "bg-red-500/10 text-red-700 dark:text-red-300",
          expired: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
        };
        return (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || colors.expired}`}
          >
            {status}
          </span>
        );
      },
    },
    {
      key: "lastUsedAt",
      header: "Last used",
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          {row.lastUsedAt ? new Date(String(row.lastUsedAt)).toLocaleDateString() : "Never"}
        </span>
      ),
    },
    {
      key: "expiresAt",
      header: "Expires",
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {row.expiresAt ? new Date(String(row.expiresAt)).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {new Date(String(row.createdAt)).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (row) => {
        const token = row as unknown as TokenRow;
        const isActive = token.status === "active";
        return (
          <div className="flex justify-end gap-2">
            {isActive && (
              <button
                type="button"
                onClick={() => onRevoke(token.id, token.name)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-red-500/10 hover:text-red-600"
                aria-label={`Revoke ${token.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      },
    },
  ];
}
