"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  partnerRegistrationDeletionReasons,
  protectedRegistrationMessage,
} from "@/lib/partners/application";

type AuditRow = {
  id: string;
  actor: string;
  action: string;
  reason: string | null;
  createdAt: string;
};
type DeliveryRow = {
  id: string;
  kind: string;
  status: string;
  attempts: number;
  sentAt: string | null;
  lastErrorCode: string | null;
};
type ApplicationRow = {
  id: string;
  program: string;
  category: string;
  fullName: string;
  email: string;
  country: string;
  companyName: string | null;
  experience: string;
  status: string;
  createdAt: string;
  onboardedAt: string | null;
  canRequestDeletion: boolean;
  audit: AuditRow[];
  deliveries: DeliveryRow[];
};

const statuses = ["pending", "under_review", "approved", "rejected", "active"];
const input = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm";

export function PartnerApplicationAdmin() {
  const [items, setItems] = useState<ApplicationRow[]>([]);
  const [count, setCount] = useState(0);
  const [filter, setFilter] = useState("pending");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [agreement] = useState<Record<string, string>>({});
  const [evidence] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<ApplicationRow | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [notice, setNotice] = useState("");
  const deleteInFlight = useRef(false);
  const loadVersion = useRef(0);
  const countRef = useRef<HTMLParagraphElement>(null);
  const deleteTitleId = useId();
  const deleteDescriptionId = useId();

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    const response = await fetch(`/api/admin/partner-applications?status=${filter}`, {
      cache: "no-store",
    });
    const body = await response.json();
    if (version !== loadVersion.current) return;
    if (!response.ok) throw new Error(body.error || "Unable to load applications.");
    setItems(body.applications);
    setCount(body.count);
  }, [filter]);
  useEffect(() => {
    load().catch((cause) => setError(cause.message));
  }, [load]);

  async function confirmDeletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deleteTarget || deleteInFlight.current) return;
    deleteInFlight.current = true;
    const id = deleteTarget.id;
    const reason = new FormData(event.currentTarget).get("reason");
    setBusy(id);
    setDeleteError("");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/partner-applications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, reason, confirm: true }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true)
        throw new Error(
          result?.error || "The registration could not be deleted. Please try again.",
        );
    } catch (cause) {
      setDeleteError(
        cause instanceof Error ? cause.message : "The registration could not be deleted.",
      );
      deleteInFlight.current = false;
      setBusy("");
      return;
    }

    setDeleteTarget(null);
    setItems((current) => current.filter((item) => item.id !== id));
    setCount((current) => Math.max(0, current - 1));
    setNotice("Partner registration deleted successfully.");
    requestAnimationFrame(() => countRef.current?.focus());
    try {
      await load();
    } catch {
      setError(
        "The application list could not be refreshed. Reload the page for the latest count.",
      );
    } finally {
      deleteInFlight.current = false;
      setBusy("");
    }
  }

  async function action(row: ApplicationRow, actionName: string) {
    const confirmation =
      ["under_review", "retry_email", "add_note"].includes(actionName) ||
      window.confirm(
        `${actionName === "approve" ? "Approve" : actionName === "reject" ? "Reject" : actionName === "renew_invitation" ? "Renew invitation for" : "Activate"} ${row.fullName}’s partner application?`,
      );
    if (!confirmation) return;
    setBusy(row.id);
    setError("");
    try {
      const response = await fetch("/api/admin/partner-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          action: actionName,
          confirm: true,
          reason: reasons[row.id] || "",
          agreement: agreement[row.id] || "",
          commercialEvidence: evidence[row.id] || "",
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to update application.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update application.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section
      className="space-y-5 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7"
      aria-labelledby="partner-application-admin-title"
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.15em] text-primary">
            Partner Administration
          </p>
          <h2 id="partner-application-admin-title" className="mt-1 text-2xl font-semibold">
            Applications
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Public applications and existing program candidates. Approval does not activate partner
            privileges.
          </p>
        </div>
        <label className="min-w-48 text-sm font-medium">
          Status filter
          <select
            className={`${input} mt-1`}
            value={filter}
            disabled={!!busy || !!deleteTarget}
            onChange={(event) => setFilter(event.target.value)}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status.replace("_", " ").replace(/^./, (value) => value.toUpperCase())}
              </option>
            ))}
          </select>
        </label>
      </header>
      <p ref={countRef} tabIndex={-1} className="text-sm text-muted-foreground">
        Registrations in this status: {count}
      </p>
      {notice && (
        <p role="status" className="rounded-xl border p-3 text-sm">
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          No {filter.replace("_", " ")} applications.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((row) => (
            <article key={row.id} className="rounded-2xl border border-border p-4 sm:p-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{row.companyName || row.fullName}</h3>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                      {row.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-1 break-all text-sm">
                    {row.fullName} · {row.email}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {row.country} ·{" "}
                    {row.program === "work_with_us" ? "Work With Us" : "Reseller & Enterprise"} ·{" "}
                    {row.category} · {new Date(row.createdAt).toLocaleString()}
                  </p>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      Application details, audit history and email delivery
                    </summary>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{row.experience}</p>
                    {!row.canRequestDeletion && (
                      <p className="mt-3 text-sm text-muted-foreground">
                        {protectedRegistrationMessage}
                      </p>
                    )}
                    {row.canRequestDeletion && (
                      <Button
                        className="mt-3"
                        variant="destructive"
                        disabled={!!busy}
                        onClick={() => {
                          setDeleteError("");
                          setDeleteTarget(row);
                        }}
                      >
                        Delete
                      </Button>
                    )}
                    <ul className="mt-3 space-y-1 border-t pt-3 text-xs text-muted-foreground">
                      {row.audit.map((entry) => (
                        <li key={entry.id}>
                          {new Date(entry.createdAt).toLocaleString()} · {entry.action} ·{" "}
                          {entry.actor}
                          {entry.reason ? ` · ${entry.reason}` : ""}
                        </li>
                      ))}
                    </ul>
                    <ul className="mt-3 space-y-2 border-t pt-3 text-xs text-muted-foreground">
                      {row.deliveries.map((delivery) => (
                        <li key={delivery.id}>
                          Email {delivery.kind}: {delivery.status} · attempts {delivery.attempts}
                          {delivery.sentAt
                            ? ` · sent ${new Date(delivery.sentAt).toLocaleString()}`
                            : ""}
                          {delivery.lastErrorCode ? ` · ${delivery.lastErrorCode}` : ""}
                          {delivery.status === "failed" && (
                            <Button
                              className="ml-2 h-7"
                              variant="outline"
                              disabled={!!busy}
                              onClick={() => action(row, "retry_email")}
                            >
                              Retry delivery
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
                {["pending", "under_review"].includes(row.status) && (
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button
                      disabled={!!busy}
                      variant="outline"
                      onClick={() => action(row, "under_review")}
                    >
                      Under Review
                    </Button>
                    <Button disabled={!!busy} onClick={() => action(row, "approve")}>
                      Approve
                    </Button>
                    <Button
                      disabled={!!busy}
                      variant="destructive"
                      onClick={() => action(row, "reject")}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
              {row.status === "approved" && (
                <Button
                  className="mt-3"
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => action(row, "renew_invitation")}
                >
                  Send new invitation
                </Button>
              )}
              <div className="mt-3 space-y-2">
                <label className="text-sm">
                  Internal note or renewal reason
                  <input
                    className={input}
                    value={reasons[row.id] || ""}
                    maxLength={1000}
                    onChange={(e) => setReasons({ ...reasons, [row.id]: e.target.value })}
                  />
                </label>
                <Button
                  variant="outline"
                  disabled={!!busy || (reasons[row.id] || "").trim().length < 10}
                  onClick={() => action(row, "add_note")}
                >
                  Save internal note
                </Button>
              </div>
              {["pending", "under_review"].includes(row.status) && (
                <label className="mt-3 block text-xs text-muted-foreground">
                  Optional internal rejection reason
                  <input
                    className={`${input} mt-1`}
                    maxLength={1000}
                    value={reasons[row.id] || ""}
                    onChange={(event) => setReasons({ ...reasons, [row.id]: event.target.value })}
                  />
                </label>
              )}
              {row.status === "approved" && row.onboardedAt && (
                <p className="mt-4 text-sm">
                  Onboarding Complete.{" "}
                  <a className="underline" href="#contract-management">
                    Review the agreement and final activation in Contract Management.
                  </a>
                </p>
              )}
            </article>
          ))}
        </div>
      )}
      {deleteTarget && (
        <Dialog
          open
          onOpenChange={(open) => !open && !deleteInFlight.current && setDeleteTarget(null)}
        >
          <DialogContent
            aria-labelledby={deleteTitleId}
            aria-describedby={deleteDescriptionId}
            dismissible={!busy}
          >
            <DialogTitle id={deleteTitleId}>Delete Partner Registration?</DialogTitle>
            <div id={deleteDescriptionId} className="mt-3">
              <DialogDescription>
                You are about to delete this partner registration. This action may permanently
                remove associated application data. Please confirm that you want to continue.
              </DialogDescription>
            </div>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt>Name</dt>
              <dd className="break-words">{deleteTarget.fullName}</dd>
              <dt>Email</dt>
              <dd className="break-all">{deleteTarget.email}</dd>
              <dt>Category</dt>
              <dd>{deleteTarget.category}</dd>
              <dt>Status</dt>
              <dd className="capitalize">{deleteTarget.status.replace("_", " ")}</dd>
            </dl>
            <form className="mt-4 space-y-3" onSubmit={confirmDeletion} aria-busy={!!busy}>
              <label className="block text-sm">
                Reason for deletion
                <select
                  name="reason"
                  className={`${input} mt-1`}
                  defaultValue=""
                  required
                  disabled={!!busy}
                >
                  <option value="" disabled>
                    Choose a reason
                  </option>
                  {Object.entries(partnerRegistrationDeletionReasons).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {deleteError && (
                <p role="alert" className="text-sm text-destructive">
                  {deleteError}
                </p>
              )}
              <DialogFooter className="flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" disabled={!!busy}>
                  {busy ? "Deleting…" : "Delete Registration"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
