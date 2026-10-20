"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AgentPassport,
  listAgentPassportTraces,
} from "@/lib/ai-governance/agent-passport-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AgentPassportEditor({
  passport,
  notice,
}: {
  passport: AgentPassport | null;
  notice: string;
}) {
  const id = useId();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(passport);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        "/api/ai-governance/passports" + (saved ? "/" + encodeURIComponent(saved.id) : ""),
        {
          method: saved ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.fromEntries(form)),
        },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Passport could not be saved.");
      setSaved(body.passport);
      setFailed(false);
      setMessage("Passport saved.");
      router.refresh();
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Passport could not be saved. Retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4" aria-label="Clevr AI Analyst passport">
      <p className="text-sm text-muted-foreground">{notice}</p>
      {saved ? (
        <p className="break-all text-sm">Passport ID: {saved.id}</p>
      ) : (
        <p className="text-sm">
          Passport not configured. Name yourself as the accountable human owner to create it.
        </p>
      )}
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={id + "-owner"}>Your name as human owner</Label>
          <Input
            id={id + "-owner"}
            name="ownerName"
            required
            maxLength={160}
            defaultValue={passport?.ownerName || ""}
            autoComplete="name"
          />
          <p className="text-xs text-muted-foreground">
            Ownership belongs to your signed-in account. This name is your declaration, not
            independent identity verification.
          </p>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={id + "-purpose"}>Purpose</Label>
          <textarea
            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            id={id + "-purpose"}
            name="purpose"
            required
            maxLength={2000}
            defaultValue={passport?.purpose || ""}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={id + "-scope"}>Declared scope</Label>
          <textarea
            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            id={id + "-scope"}
            name="declaredScope"
            required
            maxLength={4000}
            defaultValue={passport?.declaredScope || ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id + "-risk"}>Owner-declared risk</Label>
          <select
            id={id + "-risk"}
            name="riskClass"
            defaultValue={passport?.riskClass || "unclassified"}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="unclassified">Unclassified</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={id + "-lifecycle"}>Lifecycle (descriptive)</Label>
          <select
            id={id + "-lifecycle"}
            name="lifecycle"
            defaultValue={passport?.lifecycle || "draft"}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="retired">Retired</option>
          </select>
        </div>
      </fieldset>
      <Button type="submit" disabled={busy}>
        {busy ? "Saving passport…" : saved ? "Save passport" : "Create passport"}
      </Button>
      <p role={failed ? "alert" : "status"} aria-live="polite" className="text-sm">
        {message}
      </p>
    </form>
  );
}

type TracePage = Awaited<ReturnType<typeof listAgentPassportTraces>>;

export function AgentPassportTraces({ passportId }: { passportId: string }) {
  const [page, setPage] = useState<TracePage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load(offset = 0) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        "/api/ai-governance/passports/" + encodeURIComponent(passportId) + "?offset=" + offset,
        { cache: "no-store" },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Linked traces could not be loaded.");
      setPage(body);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Linked traces could not be loaded. Retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => load(page?.offset || 0)}
      >
        {busy ? "Loading traces…" : page ? "Refresh linked traces" : "View linked traces"}
      </Button>
      <p role="alert" className="text-sm">
        {error}
      </p>
      {page && (
        <>
          <p role="status" className="text-sm text-muted-foreground">
            {page.total} linked traces. Existing unassigned traces and Eclipse Mode content are not
            included.
          </p>
          {page.traces.length === 0 ? (
            <p className="text-sm">No linked traces in this page.</p>
          ) : (
            <ul className="divide-y divide-border">
              {page.traces.map((trace) => (
                <li key={trace.id} className="space-y-1 py-3 text-sm">
                  <p className="break-all font-medium">{trace.id}</p>
                  <p>
                    {trace.providerName} · {trace.modelName}
                  </p>
                  <p className="break-all text-muted-foreground">
                    {trace.createdAt} · Dataset: {trace.datasetId || "None"}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy || page.offset === 0}
              onClick={() => load(Math.max(0, page.offset - 20))}
            >
              Previous traces
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || page.offset + 20 >= page.total}
              onClick={() => load(page.offset + 20)}
            >
              Next traces
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
