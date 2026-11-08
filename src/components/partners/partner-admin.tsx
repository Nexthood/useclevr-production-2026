"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PartnerPerformance, money, type PartnerSummary } from "./partner-dashboard";
import { defaultConfig, type ProgramConfig } from "@/lib/partners/rules";

type PartnerRow = {
  id: string;
  name: string;
  country: string;
  market: string | null;
  status: string;
  agreement: string;
  notes: string;
  userId: string;
};
type Overview = {
  partners: PartnerRow[];
  config: ProgramConfig;
  heldEvents: { id: string; reason: string; objectId: string; evidence: Record<string, unknown> }[];
  configId: string | null;
  configurations: { id: string; config: ProgramConfig; effectiveAt: string }[];
  liabilities: { currency: string; amountMinor: string }[];
  totals: { total: number; active: number };
  nextOffset: number | null;
};
const field = "w-full rounded-md border bg-background p-2 text-sm";
function Fields({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
function Input({
  label,
  name,
  required = true,
  ...rest
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <label className="space-y-1 text-sm">
      {label}
      <input name={name} required={required} className={field} {...rest} />
    </label>
  );
}
export function PartnerAdmin() {
  const [overview, setOverview] = useState<Overview | null>(null),
    [config, setConfig] = useState<ProgramConfig>(defaultConfig),
    [detail, setDetail] = useState<PartnerSummary | null>(null);
  const [q, setQ] = useState(""),
    [offset, setOffset] = useState(0),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState("");
  const [classificationEvidence, setClassificationEvidence] = useState("");
  async function load(pageOffset = offset) {
    const r = await fetch(`/api/admin/partners?q=${encodeURIComponent(q)}&offset=${pageOffset}`, {
      cache: "no-store",
    });
    const b = await r.json();
    if (!r.ok) throw new Error(b.error);
    setOverview(b);
    setConfig(b.config);
  }
  async function select(id: string, pageOffset = 0) {
    const r = await fetch(
      `/api/admin/partners?partnerId=${encodeURIComponent(id)}&offset=${pageOffset}`,
      {
        cache: "no-store",
      },
    );
    const b = await r.json();
    if (!r.ok) throw new Error(b.error);
    setDetail(b);
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, [offset]); // Search submits explicitly.
  async function act(body: Record<string, unknown>) {
    if (!reason.trim()) {
      setMessage("Enter an audit reason before making a change.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/admin/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, reason }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setMessage(b.reason ? `Held for review: ${b.reason}` : "Saved.");
      await load();
      if (detail) await select(detail.partner.id);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Operation failed.");
    } finally {
      setBusy(false);
    }
  }
  const form = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    return Object.fromEntries(new FormData(e.currentTarget).entries());
  };
  return (
    <div className="space-y-5">
      <label className="block text-sm font-medium">
        Audit reason for changes
        <input
          className={`${field} mt-1`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
        />
      </label>
      {message && (
        <p role="status" className="rounded border p-3 text-sm">
          {message}
        </p>
      )}
      <div className="flex flex-wrap gap-4">
        <p className="rounded border p-3 text-sm">
          Partners: {overview?.totals.total ?? 0} · Active: {overview?.totals.active ?? 0}
        </p>
        {overview?.liabilities.map((b) => (
          <p key={b.currency} className="rounded border p-3 text-sm">
            Outstanding liability: <strong>{money(b.amountMinor, b.currency)}</strong>
          </p>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setOffset(0);
          load(0).catch((e) => setMessage(e.message));
        }}
        className="flex gap-2"
      >
        <label className="sr-only" htmlFor="partner-search">
          Search partners
        </label>
        <input
          id="partner-search"
          className={field}
          placeholder="Search partner, country, or market"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button variant="outline">Search</Button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Partners</caption>
          <thead>
            <tr>
              {["Partner", "Country", "Market", "Status", "Performance"].map((v) => (
                <th key={v} className="p-2 text-left">
                  {v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {overview?.partners.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-2">{p.name}</td>
                <td className="p-2">{p.country}</td>
                <td className="p-2">{p.market || "—"}</td>
                <td className="p-2">{p.status}</td>
                <td className="p-2">
                  <Button
                    variant="outline"
                    onClick={() => select(p.id).catch((e) => setMessage(e.message))}
                  >
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={!offset}
          onClick={() => setOffset(Math.max(0, offset - 50))}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={!overview?.nextOffset}
          onClick={() => setOffset(overview!.nextOffset!)}
        >
          Next
        </Button>
      </div>
      {detail && (
        <section className="space-y-4 rounded-lg border p-4">
          <div className="flex justify-between">
            <h2 className="font-semibold">Partner performance</h2>
            <Button variant="outline" onClick={() => setDetail(null)}>
              Close
            </Button>
          </div>
          {detail.partner.application && (
            <div className="space-y-2 text-sm">
              <h3 className="font-semibold">Application</h3>
              <p>Verified email: {detail.partner.application.email}</p>
              <p className="whitespace-pre-wrap">{detail.partner.application.experience}</p>
              <p>
                Privacy acknowledgment: {detail.partner.application.privacyVersion} ·{" "}
                {detail.partner.application.acceptedAt}
              </p>
            </div>
          )}
          <PartnerPerformance
            key={detail.offset}
            data={detail}
            loadPage={(pageOffset) =>
              select(detail.partner.id, pageOffset).catch((e) => setMessage(e.message))
            }
          />
          <a
            className="inline-block text-sm underline"
            href={`/api/admin/partners?partnerId=${encodeURIComponent(detail.partner.id)}&export=csv`}
          >
            Export financial report
          </a>
          <form
            key={detail.partner.id}
            className="space-y-3"
            onSubmit={(e) => {
              const v = form(e);
              act({
                action: "partner",
                partnerId: detail.partner.id,
                ...v,
                market: v.market || null,
              });
            }}
          >
            <Fields>
              <label className="text-sm">
                Status
                <select
                  name="status"
                  defaultValue={
                    detail.partner.status === "pending" ? "active" : detail.partner.status
                  }
                  className={field}
                >
                  <option value="active">Approve / active</option>
                  <option value="rejected">Reject application</option>
                  <option value="suspended">Suspended</option>
                  <option value="terminated">Terminated</option>
                </select>
              </label>
              <Input
                name="country"
                label="Country (ISO code)"
                defaultValue={detail.partner.country}
              />
              <Input
                name="market"
                label="Assigned market"
                required={false}
                defaultValue={detail.partner.market || ""}
              />
              <Input
                name="agreement"
                label="Commission agreement reference"
                defaultValue={detail.partner.agreement}
              />
              <Input
                name="notes"
                label="Administrative notes"
                required={false}
                defaultValue={String(detail.partner.notes || "")}
              />
            </Fields>
            <Button disabled={busy}>Save partner</Button>
          </form>
          <p role="status" className="text-sm">
            Settlement review: {detail.partner.payoutHold ? "held" : "cleared"}.
            {detail.partner.status === "terminated" &&
              " Only valid pre-termination earnings may settle; referrals and accrual stay stopped."}
          </p>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              const v = form(e);
              act({
                action: "payout_review",
                partnerId: detail.partner.id,
                release: v.release === "release",
                evidence: v.evidence,
              });
            }}
          >
            <Fields>
              <label className="text-sm">
                Financial review decision
                <select name="release" className={field}>
                  <option value="hold">Keep / place payout hold</option>
                  <option value="release">Clear hold after earnings and fraud review</option>
                </select>
              </label>
              <Input label="Review evidence / case reference" name="evidence" />
            </Fields>
            <Button variant="outline" disabled={busy || detail.partner.status === "suspended"}>
              Record payout review
            </Button>
          </form>
          <details>
            <summary className="cursor-pointer font-medium">
              Approve commissions and record settlements
            </summary>
            <div className="space-y-3 pt-3">
              {detail.commissions
                .filter((c) => c.state === "pending")
                .map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b py-2"
                  >
                    <span className="text-sm">
                      {new Date(c.earnedAt).toLocaleDateString()} · {money(c.dueMinor, c.currency)}
                    </span>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => act({ action: "approve", commissionId: c.id })}
                    >
                      Approve
                    </Button>
                  </div>
                ))}
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  const v = form(e);
                  const currency = String(v.currency);
                  const amount = detail.balances[currency].settlement;
                  act({
                    action: "payout",
                    partnerId: detail.partner.id,
                    currency,
                    reference: v.reference,
                    amountMinor: amount.toString(),
                  });
                }}
              >
                <p className="text-sm">
                  Record an already completed manual payment for the exact eligible statement
                  balance. This does not transfer money.
                </p>
                <Fields>
                  <label className="text-sm">
                    Currency
                    <select name="currency" className={field}>
                      {Object.keys(detail.balances).map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <Input name="reference" label="Unique bank / settlement reference" />
                </Fields>
                <Button disabled={busy || !Object.keys(detail.balances).length}>
                  Record manual payout
                </Button>
              </form>
            </div>
          </details>
          <details>
            <summary className="cursor-pointer font-medium">Related-party review</summary>
            <label className="block text-sm">
              Classification evidence / case reference
              <input
                className={field}
                value={classificationEvidence}
                onChange={(e) => setClassificationEvidence(e.target.value)}
                maxLength={4000}
              />
            </label>
            <div className="space-y-2 pt-3">
              {detail.attributions?.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span>
                    {a.id} · {a.relatedParty}
                  </span>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      act({
                        action: "related",
                        attributionId: a.id,
                        classification: "unrelated",
                        evidence: classificationEvidence,
                      })
                    }
                  >
                    Confirm unrelated
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      act({
                        action: "related",
                        attributionId: a.id,
                        classification: "related",
                        evidence: classificationEvidence,
                      })
                    }
                  >
                    Mark related
                  </Button>
                </div>
              ))}
            </div>
          </details>
          <details>
            <summary className="cursor-pointer font-medium">Refund and audit history</summary>
            <ul className="space-y-2 pt-3 text-sm">
              {detail.adjustments.map((a) => (
                <li key={a.id}>
                  {a.kind} · payment {a.paymentId} · commission adjustment {a.commissionDeltaMinor}{" "}
                  minor units
                </li>
              ))}
              {detail.audit?.map((a) => (
                <li key={a.id}>
                  {new Date(a.createdAt).toLocaleString()} · {a.action} · {a.reason}
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}
      <details>
        <summary className="cursor-pointer font-semibold">Register a partner</summary>
        <form
          className="space-y-3 pt-3"
          onSubmit={(e) => {
            const v = form(e);
            act({ action: "create", ...v, market: v.market || null });
          }}
        >
          <Fields>
            <Input label="Verified account ID" name="userId" />
            <Input label="Partner name" name="name" />
            <Input label="Country (ISO code)" name="country" />
            <Input label="Assigned market" name="market" required={false} />
            <Input label="Commission agreement reference" name="agreement" />
          </Fields>
          <Button disabled={busy}>Register for approval</Button>
        </form>
      </details>
      <details>
        <summary className="cursor-pointer font-semibold">
          Program configuration and financial policies
        </summary>
        <Button
          className="mt-3"
          variant="outline"
          onClick={() => setConfig({ ...defaultConfig, enabled: false })}
        >
          Load approved v1 policies with accrual disabled
        </Button>
        <p className="mt-3 text-sm">
          Effective version: {overview?.configId || "No persisted configuration"}. Saving appends a
          version effective now; historical versions stay unchanged.
        </p>
        <form
          className="space-y-4 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            act({ action: "config", config });
          }}
        >
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
            />
            Enable accrual after policy review
          </label>
          <Fields>
            {(
              [
                ["standardBps", "Standard commission (basis points; 1500 = 15%)"],
                ["premiumBps", "Gold+ commission (basis points; 2000 = 20%)"],
                ["silverCustomers", "Silver paying customers"],
                ["goldCustomers", "Gold paying customers"],
                ["platinumUsdMinor", "Platinum rolling revenue (USD cents)"],
                ["diamondUsdMinor", "Diamond rolling revenue (USD cents)"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="text-sm">
                {label}
                <input
                  className={field}
                  type="number"
                  min="0"
                  value={config[key]}
                  readOnly
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      [key]: key.endsWith("Minor") ? e.target.value : Number(e.target.value),
                    })
                  }
                />
              </label>
            ))}
          </Fields>
          <Fields>
            {(
              [
                ["eligibilityAnchor", "12-month eligibility starts", ["signup", "first_payment"]],
                ["suspendedAccrual", "Suspended partner accrual", ["hold", "continue", "stop"]],
                ["terminatedAccrual", "Terminated partner accrual", ["hold", "continue", "stop"]],
                ["relatedParty", "Related-party purchases", ["hold", "exclude", "allow"]],
                ["postPayoutRefund", "Refund after payout", ["hold", "offset"]],
              ] as const
            ).map(([key, label, options]) => (
              <label key={key} className="text-sm">
                {label}
                <select
                  className={field}
                  value={config[key] || ""}
                  disabled
                  onChange={(e) => setConfig({ ...config, [key]: e.target.value || null })}
                >
                  <option value="">Owner decision required</option>
                  {options.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </Fields>
          <Fields>
            {(
              [
                ["downgradeGraceDays", "Downgrade grace days (0 = immediate)"],
                ["waitingDays", "Payout waiting days"],
              ] as const
            ).map(([key, label]) => (
              <label className="text-sm" key={key}>
                {label}
                <input
                  className={field}
                  type="number"
                  min="0"
                  max="365"
                  value={config[key] ?? ""}
                  readOnly
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      [key]: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
            ))}
            <label className="text-sm">
              Minimum payout per currency (minor units, JSON)
              <input
                className={field}
                key={JSON.stringify(config.minimumPayoutMinor)}
                defaultValue={JSON.stringify(config.minimumPayoutMinor)}
                onBlur={(e) => {
                  try {
                    setConfig({ ...config, minimumPayoutMinor: JSON.parse(e.target.value) });
                  } catch {
                    setMessage(
                      'Minimum payouts require a JSON currency map, for example {"USD":"5000"}.',
                    );
                  }
                }}
              />
            </label>
          </Fields>
          <p className="text-sm text-muted-foreground">
            Self-purchases are blocked. Unresolved policies hold accrual or settlements.
            Configuration changes apply prospectively; earned rates remain fixed.
          </p>
          <Button disabled={busy}>Save configuration version</Button>
        </form>
      </details>
      <details>
        <summary className="cursor-pointer font-semibold">
          Record an evidenced exchange rate
        </summary>
        <form className="space-y-3 pt-3" onSubmit={(e) => act({ action: "fx", ...form(e) })}>
          <p className="text-sm">
            Enter USD minor units per source minor unit as an exact numerator / denominator. Include
            the publication date and source URL. Do not estimate rates.
          </p>
          <Fields>
            <Input label="Source currency (ISO code)" name="currency" />
            <Input label="Payment date (UTC)" name="day" type="date" />
            <Input label="USD minor numerator" name="numerator" />
            <Input label="Source minor denominator" name="denominator" />
            <Input label="Published rate source URL" name="source" type="url" />
          </Fields>
          <Button disabled={busy}>Record exchange rate</Button>
        </form>
      </details>
      <details>
        <summary className="cursor-pointer font-semibold">
          Held payment events ({overview?.heldEvents.length || 0})
        </summary>
        <ul className="space-y-3 pt-3">
          {overview?.heldEvents.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 text-sm">
              <span>
                {e.objectId} · {e.reason || "Awaiting processing"}
              </span>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => act({ action: "replay", eventId: e.id })}
              >
                Retry original evidence
              </Button>
              <details className="w-full">
                <summary className="cursor-pointer">Review historical payment recovery</summary>
                <pre className="my-3 max-h-64 overflow-auto whitespace-pre-wrap text-xs">
                  {JSON.stringify(e.evidence, null, 2)}
                </pre>
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    const values = form(event);
                    act({ action: "review_event", eventId: e.id, ...values });
                  }}
                >
                  <p>
                    Review original payment, first-payment date, policy version, and level evidence.
                    Recovery creates a pending commission only; approval and settlement require
                    separate actions.
                  </p>
                  <Fields>
                    <label>
                      Approved policy version
                      <select name="configId" className={field} required>
                        <option value="">Choose reviewed version</option>
                        {overview?.configurations
                          .filter((v) => v.config.enabled)
                          .map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.id} · {new Date(v.effectiveAt).toLocaleString()}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Historically evidenced level
                      <select name="level" className={field} required>
                        <option value="">Choose reviewed level</option>
                        {["bronze", "silver", "gold", "platinum", "diamond"].map((level) => (
                          <option key={level}>{level}</option>
                        ))}
                      </select>
                    </label>
                    <Input
                      label="Payment, eligibility, and level evidence / case reference"
                      name="evidence"
                    />
                  </Fields>
                  <Button disabled={busy}>Authorize this payment recovery</Button>
                </form>
              </details>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
