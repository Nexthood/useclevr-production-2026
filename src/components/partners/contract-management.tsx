"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { contractDocument, contractLabels, type ContractData } from "./contract-types";
const field = "w-full rounded-md border bg-background p-2 text-sm";
const commercialFields = [
  "scope",
  "commissionRates",
  "commissionCalculation",
  "qualifyingReceivedRevenue",
  "eligibilityPeriod",
  "exclusions",
  "paymentTerms",
  "taxAndInvoicing",
  "refundsAndChargebacks",
  "territory",
  "exclusivity",
  "termAndRenewal",
  "terminationNotice",
  "liabilityAndIndemnity",
  "governingLaw",
  "disputeResolution",
  "dataProtectionSchedule",
];
const label = (value: string) =>
  value.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
export function ContractManagement() {
  const [data, setData] = useState<ContractData | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState("");
  async function load() {
    const r = await fetch("/api/admin/partner-contracts", { cache: "no-store" });
    const b = await r.json();
    if (!r.ok) throw new Error(b.error);
    setData(b);
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);
  async function act(action: string, id = "runtime", extra: Record<string, unknown> = {}) {
    const sensitive =
      action.startsWith("approve_") ||
      action.startsWith("revoke_") ||
      ["activate", "cancel", "recover_absent"].includes(action);
    if (
      sensitive &&
      !window.confirm(
        action === "activate"
          ? "Activate this partner commercially using the verified, fully executed agreement? No payout is created."
          : "Confirm this recorded decision for the exact reviewed version? Legal approvals require completed qualified legal review.",
      )
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/admin/partner-contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          id,
          reason: reason || undefined,
          confirm: sensitive,
          ...extra,
        }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setMessage("Decision recorded. Refresh after processing queued work.");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  if (!data?.enabled) return message ? <p role="alert">{message}</p> : null;
  return (
    <section id="contract-management" className="space-y-5 rounded-lg border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Contract Management</h2>
        <Button disabled={busy} variant="outline" onClick={() => act("run")}>
          Process pending work
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Applications, agreements and commercial activation have separate states. Test agreements
        cannot authorize activation.
      </p>
      <label className="block text-sm">
        Decision evidence or legal review reference
        <input
          className={field}
          value={reason}
          maxLength={1000}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <p role="status" className="text-sm">
        {message}
      </p>
      {data.applications
        .filter((a) => ["approved", "active"].includes(a.status))
        .map((a) => (
          <article key={a.id} className="space-y-3 border-t pt-4">
            <h3 className="font-semibold">
              {a.fullName} · {a.category}
            </h3>
            <p className="text-sm">
              Application Approved · {a.onboardedAt ? "Onboarding Complete" : "Onboarding Pending"}
            </p>
            <Button
              disabled={busy || !a.onboardedAt}
              variant="outline"
              onClick={() => act("prepare", a.id)}
            >
              Generate or refresh agreement
            </Button>
            {data.profiles
              .filter((p) => p.applicationId === a.id)
              .map((p) => (
                <details key={p.id}>
                  <summary>
                    Legal identity version {p.version} ·{" "}
                    {p.reviewedAt ? "Reviewed" : "Review required"}
                  </summary>
                  <p className="text-sm">
                    {p.identity.legalName} · {p.identity.address} · {p.identity.country} ·{" "}
                    {p.identity.signerName} ({p.identity.signerTitle})
                  </p>
                  <p className="break-all text-xs">SHA-256 {p.checksum}</p>
                  {!p.reviewedAt && (
                    <Button
                      disabled={busy || reason.length < 10}
                      onClick={() => act("review_identity", p.id)}
                    >
                      Confirm identity and authority review
                    </Button>
                  )}
                </details>
              ))}
            {data.schedules
              .filter((s) => s.applicationId === a.id)
              .map((s) => (
                <details key={s.id}>
                  <summary>
                    Commercial schedule {s.version} ·{" "}
                    {s.revokedAt ? "Revoked" : s.approvedAt ? "Approved" : "Draft"}
                  </summary>
                  <pre className="overflow-auto whitespace-pre-wrap text-xs">
                    {JSON.stringify(s.schedule, null, 2)}
                  </pre>
                  <p className="break-all text-xs">SHA-256 {s.checksum}</p>
                  {data.owner && (
                    <div className="flex gap-2">
                      <Button
                        disabled={busy || !!s.approvedAt || !!s.revokedAt || reason.length < 5}
                        onClick={() => act("approve_schedule", s.id, { checksum: s.checksum })}
                      >
                        Approve legally reviewed schedule
                      </Button>
                      <Button
                        disabled={busy || !!s.revokedAt || reason.length < 10}
                        variant="outline"
                        onClick={() => act("revoke_schedule", s.id)}
                      >
                        Revoke approval
                      </Button>
                    </div>
                  )}
                </details>
              ))}
            <details>
              <summary>Create a commercial schedule version</summary>
              <p className="my-2 text-sm">
                Enter owner-approved terms aligned with the current commission policy. Creating a
                schedule does not change that policy.
              </p>
              <form
                className="grid gap-3 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget),
                    s = (k: string) => String(f.get(k) || "");
                  void act("create_schedule", a.id, {
                    schedule: {
                      version: s("version"),
                      agreementType: s("agreementType"),
                      company: {
                        legalName: "Atlas Mega Ventures LLC",
                        registrationId: s("registrationId"),
                        registrationJurisdiction: s("registrationJurisdiction"),
                        address: s("address"),
                        country: s("country"),
                        noticeEmail: s("noticeEmail"),
                      },
                      companySigner: {
                        reference: s("signerRef"),
                        name: s("signerName"),
                        email: s("signerEmail"),
                        title: s("signerTitle"),
                      },
                      terms: Object.fromEntries(commercialFields.map((k) => [k, s(k)])),
                      financialConfigId: data.financialConfig?.id || "",
                      financialAlignmentConfirmed: true,
                      ...(s("effectiveUntil")
                        ? { effectiveUntil: new Date(s("effectiveUntil")).toISOString() }
                        : {}),
                    },
                  });
                }}
              >
                <label className="text-sm">
                  Agreement type
                  <select className={field} name="agreementType">
                    <option value="independent_sales">Independent Sales Partner</option>
                    <option value="authorized_reseller">Authorized Reseller</option>
                  </select>
                </label>
                {[
                  "version",
                  "registrationId",
                  "registrationJurisdiction",
                  "address",
                  "country",
                  "noticeEmail",
                  "signerRef",
                  "signerName",
                  "signerEmail",
                  "signerTitle",
                ].map((k) => (
                  <label key={k} className="text-sm">
                    {label(k)}
                    <input name={k} required className={field} maxLength={1000} />
                  </label>
                ))}
                {commercialFields.map((k) => (
                  <label key={k} className="text-sm">
                    {label(k)}
                    <textarea name={k} required minLength={5} maxLength={4000} className={field} />
                  </label>
                ))}
                <label className="text-sm">
                  Schedule eligibility deadline (optional)
                  <input name="effectiveUntil" type="datetime-local" className={field} />
                </label>
                <label className="text-sm">
                  <input type="checkbox" required /> I reviewed alignment with the current financial
                  policy. No rates are changed.
                </label>
                <Button disabled={busy || !data.financialConfig}>Save draft schedule</Button>
              </form>
            </details>
            {data.contracts
              .filter((c) => c.applicationId === a.id)
              .map((c) => (
                <div key={c.id} className="space-y-2 rounded-md bg-muted/30 p-3">
                  <h4 className="font-medium">
                    Revision {c.revision} · {contractLabels[c.status] || c.status}
                  </h4>
                  <p className="text-sm">
                    Template {c.templateVersion} · Terms {c.commercialTermsVersion} ·{" "}
                    {c.mode === "dropbox_live" ? "Production" : "Non-binding test / draft"}
                  </p>
                  <p className="text-sm">
                    Partner signature: {c.partnerSignedAt || "Pending"} · Company signature:{" "}
                    {c.companySignedAt || "Pending"}
                  </p>
                  <p className="text-sm">
                    Activation:{" "}
                    {c.partnerStatus === "active"
                      ? "Active"
                      : c.readyForActivation
                        ? "Ready for Activation"
                        : "Pending required executed agreement"}
                  </p>
                  {c.lastErrorCode && (
                    <p className="text-sm">{c.lastErrorCode.replaceAll("_", " ")}</p>
                  )}
                  <div className="flex flex-wrap gap-3 text-sm">
                    {c.sourceAvailable && (
                      <a className="underline" href={contractDocument(c.id, "source")}>
                        Review generated PDF
                      </a>
                    )}
                    {c.signedAvailable && (
                      <a className="underline" href={contractDocument(c.id, "signed")}>
                        Download completed agreement
                      </a>
                    )}
                    {c.auditAvailable && (
                      <a className="underline" href={contractDocument(c.id, "audit")}>
                        Download execution evidence
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={busy}
                      variant="outline"
                      onClick={() => act("reconcile", c.id)}
                    >
                      Refresh signature progress
                    </Button>
                    <Button disabled={busy} variant="outline" onClick={() => act("remind", c.id)}>
                      Send signing reminder
                    </Button>
                    <Button
                      disabled={busy || c.status === "fully_executed" || reason.length < 5}
                      variant="outline"
                      onClick={() => act("cancel", c.id)}
                    >
                      Cancel signing request
                    </Button>
                    <Button
                      disabled={
                        busy ||
                        !c.readyForActivation ||
                        c.partnerStatus !== "pending" ||
                        reason.length < 10
                      }
                      onClick={() => act("activate", c.id)}
                    >
                      Approve final commercial activation
                    </Button>
                    {data.owner && c.status === "send_uncertain" && (
                      <Button
                        disabled={busy || reason.length < 15}
                        variant="outline"
                        onClick={() => act("recover_absent", c.id)}
                      >
                        Confirm provider review: no request exists
                      </Button>
                    )}
                    {c.mode === "mock" &&
                      ["partner", "company", "expire"].map((step) => (
                        <Button
                          key={step}
                          disabled={busy}
                          variant="outline"
                          onClick={() => act(`mock_${step}`, c.id)}
                        >
                          Simulate {step} (non-binding)
                        </Button>
                      ))}
                  </div>
                  <details>
                    <summary>Delivery history</summary>
                    {c.deliveries?.map((d) => (
                      <p key={d.id} className="text-sm">
                        {label(d.kind)} · {d.recipientRole} · {d.status} ·{" "}
                        {d.lastErrorCode?.replaceAll("_", " ")}
                        {["failed", "pending"].includes(d.status) && (
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => act("retry_email", d.id)}
                          >
                            Retry delivery
                          </Button>
                        )}
                      </p>
                    ))}
                  </details>
                  <details>
                    <summary>Immutable audit history</summary>
                    {c.audit?.map((r) => (
                      <p key={r.id} className="text-sm">
                        {new Date(r.createdAt).toLocaleString()} · {r.action.replaceAll("_", " ")} ·{" "}
                        {r.reason}
                      </p>
                    ))}
                  </details>
                </div>
              ))}
          </article>
        ))}
      <details>
        <summary>Agreement templates and legal approval</summary>
        {data.templates.map((t) => (
          <div key={t.id} className="my-4 space-y-2">
            <h3 className="font-medium">
              {t.title} · {t.version} ·{" "}
              {t.revokedAt
                ? "Revoked"
                : t.approvedAt
                  ? "Approved"
                  : "Draft — legal review required"}
            </h3>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap text-xs">{t.body}</pre>
            <p className="break-all text-xs">SHA-256 {t.checksum}</p>
            {data.owner && (
              <div className="flex gap-2">
                <Button
                  disabled={busy || !!t.approvedAt || !!t.revokedAt || reason.length < 5}
                  onClick={() => act("approve_template", t.id, { checksum: t.checksum })}
                >
                  Approve following legal review
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || !!t.revokedAt || reason.length < 10}
                  onClick={() => act("revoke_template", t.id)}
                >
                  Revoke approval
                </Button>
              </div>
            )}
          </div>
        ))}
      </details>
      {data.owner && data.runtime && (
        <details>
          <summary>Owner provider configuration approval</summary>
          <pre className="overflow-auto whitespace-pre-wrap text-xs">
            {JSON.stringify(data.runtime.policy, null, 2)}
          </pre>
          <p className="break-all text-xs">Configuration SHA-256 {data.runtime.checksum}</p>
          <p className="text-sm">
            Approve only after the provider account, signing assurance, data processing, retention,
            budget and authorized signer have been reviewed.
          </p>
          <Button
            disabled={busy || reason.length < 5}
            onClick={() => act("approve_provider", "runtime", { checksum: data.runtime!.checksum })}
          >
            Approve reviewed provider configuration
          </Button>
          <Button
            disabled={busy || reason.length < 5}
            variant="outline"
            onClick={() => act("revoke_provider", "runtime", { checksum: data.runtime!.checksum })}
          >
            Revoke provider approval
          </Button>
        </details>
      )}
    </section>
  );
}
