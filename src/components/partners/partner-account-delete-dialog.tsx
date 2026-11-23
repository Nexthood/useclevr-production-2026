"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { partnerRegistrationDeletionReasons } from "@/lib/partners/application";

type Partner = { id: string; name: string; status: string };
type DeletionPreview = Partner & {
  email: string | null;
  permitted: boolean;
  explanation: string | null;
  applicationCount: number;
  scope: string;
};

export function PartnerAccountDeleteDialog({
  partner,
  onClose,
  onDeleted,
  onManage,
}: {
  partner: Partner;
  onClose: () => void;
  onDeleted: () => void;
  onManage: () => void;
}) {
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const deleting = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const controller = new AbortController();
    async function loadPreview() {
      try {
        const response = await fetch(
          `/api/admin/partners?deletionPartnerId=${encodeURIComponent(partner.id)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to check deletion eligibility.");
        if (!controller.signal.aborted) setPreview(body);
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : "Unable to check deletion eligibility.",
          );
      }
    }
    void loadPreview();
    return () => controller.abort();
  }, [partner.id]);

  async function confirmDeletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview?.permitted || deleting.current) return;
    deleting.current = true;
    setBusy(true);
    setError("");
    const reason = new FormData(event.currentTarget).get("reason");
    try {
      const response = await fetch("/api/admin/partners", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerId: partner.id,
          reason,
          confirm: true,
          scope: preview.scope,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || body?.ok !== true) {
        const message =
          body?.error || "The partner account could not be deleted. Please try again.";
        if (response.status === 409)
          setPreview({ ...preview, permitted: false, explanation: message });
        else setError(message);
        return;
      }
      onDeleted();
    } catch {
      setError("The partner account could not be deleted. Please try again.");
    } finally {
      deleting.current = false;
      setBusy(false);
    }
  }

  const { name, status } = preview || partner;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !deleting.current) onClose();
      }}
    >
      <DialogContent aria-labelledby={titleId} aria-describedby={descriptionId} dismissible={!busy}>
        <DialogTitle id={titleId}>Delete Partner Account?</DialogTitle>
        <div id={descriptionId} className="mt-3">
          <DialogDescription>
            Review this account and its records before confirming deletion.
          </DialogDescription>
        </div>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt>Partner</dt>
          <dd className="break-words">{name}</dd>
          <dt>Registered email</dt>
          <dd className="break-all">{preview ? preview.email || "Unavailable" : "Checking…"}</dd>
          <dt>Status</dt>
          <dd className="capitalize">{status.replaceAll("_", " ")}</dd>
          <dt>Deletion</dt>
          <dd>
            {preview
              ? preview.permitted
                ? "Permitted"
                : "Blocked"
              : error
                ? "Unavailable"
                : "Checking…"}
          </dd>
        </dl>
        {preview?.permitted && (
          <p className="mt-4 text-sm">
            This permanently removes the commercial partner account
            {preview.applicationCount > 0 &&
              ` and its ${preview.applicationCount} eligible linked application${preview.applicationCount === 1 ? "" : "s"}`}
            .{" "}
            {preview.applicationCount > 0 &&
              "Any linked invitations and incomplete onboarding access will be revoked. "}
            The UseClevr login and audit history stay available. The email can be used to register
            again.
          </p>
        )}
        {preview && !preview.permitted && (
          <div className="mt-4 space-y-2 text-sm" role="status">
            <p>{preview.explanation}</p>
            <p>Use the partner details to manage suspension or termination when appropriate.</p>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}
        <form className="mt-4 space-y-3" onSubmit={confirmDeletion} aria-busy={busy}>
          {preview?.permitted && (
            <label className="block text-sm">
              Reason for deletion
              <select
                name="reason"
                className="mt-1 w-full rounded-md border bg-background p-2"
                defaultValue=""
                required
                disabled={busy}
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
          )}
          <DialogFooter className="flex-wrap">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              {preview?.permitted ? "Cancel" : "Close"}
            </Button>
            {preview?.permitted && (
              <Button type="submit" variant="destructive" disabled={busy}>
                {busy ? "Deleting…" : "Delete Partner Account"}
              </Button>
            )}
            {preview && !preview.permitted && (
              <Button type="button" onClick={onManage}>
                View partner account
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
