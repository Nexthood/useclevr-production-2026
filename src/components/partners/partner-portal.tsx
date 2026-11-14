"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  PartnerDashboard,
  PartnerPerformance,
  money,
  type PartnerSummary,
} from "./partner-dashboard";
import { PartnerContracts } from "./partner-contracts";
const sections = [
  "Overview",
  "My Customers",
  "Sales",
  "Commissions",
  "My Contracts",
  "Referral Links",
  "Performance",
  "Payouts",
  "Profile",
];
function Profile() {
  const [p, setP] = useState<{
      name: string;
      email: string;
      companyName: string;
      companyWebsite: string;
      communications: boolean;
    } | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/partners/profile", { cache: "no-store" })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error);
        setP(b);
      })
      .catch((e) => setMessage(e.message));
  }, []);
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Contact profile</h2>
      <p>
        These details support partner communications. Signed legal identity and commercial terms
        require a separate agreement review. Contact the partner team to update verified email or
        payment instructions.
      </p>
      <p role="status">{message}</p>
      {p && (
        <form
          className="max-w-xl space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMessage("");
            try {
              const { email: _email, ...body } = p;
              const r = await fetch("/api/partners/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              });
              const b = await r.json();
              if (!r.ok) throw new Error(b.error);
              setMessage("Contact profile saved.");
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Profile could not be saved.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>Verified email: {p.email}</p>
          {(
            [
              ["name", "Contact name"],
              ["companyName", "Company name"],
              ["companyWebsite", "Company website"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block">
              {label}
              <input
                className="mt-1 block w-full rounded border bg-background p-3"
                required={key === "name"}
                type={key === "companyWebsite" ? "url" : "text"}
                maxLength={key === "companyWebsite" ? 500 : 200}
                value={p[key]}
                onChange={(e) => setP({ ...p, [key]: e.target.value })}
              />
            </label>
          ))}
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={p.communications}
              onChange={(e) => setP({ ...p, communications: e.target.checked })}
            />
            Receive partner program updates (required account emails still apply)
          </label>
          <Button disabled={busy}>{busy ? "Saving…" : "Save contact profile"}</Button>
        </form>
      )}
    </section>
  );
}
export function PartnerPortal() {
  const [section, setSection] = useState("Overview"),
    [data, setData] = useState<PartnerSummary | null>(null),
    [error, setError] = useState(""),
    [offset, setOffset] = useState(0),
    [copied, setCopied] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    fetch(`/api/partners?offset=${offset}`, { cache: "no-store" })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error);
        if (active && b.partner) setData(b);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [offset]);
  return (
    <div className="space-y-6">
      <nav aria-label="Partner navigation" className="flex flex-wrap gap-2 border-b pb-4">
        {sections.map((s) => (
          <Button
            key={s}
            variant={section === s ? "default" : "outline"}
            aria-current={section === s ? "page" : undefined}
            onClick={() => setSection(s)}
          >
            {s}
          </Button>
        ))}
        <a className="self-center px-3 underline" href="/api/auth/signout">
          Sign out
        </a>
      </nav>
      {section === "My Contracts" ? (
        <PartnerContracts />
      ) : section === "Profile" ? (
        <Profile />
      ) : !data ? (
        <>
          <PartnerDashboard />
          {error && <p role="alert">{error}</p>}
        </>
      ) : (
        <>
          {["Overview", "Commissions"].includes(section) && (
            <>
              <p className="text-sm">
                {data.totalCustomers} total referrals · {data.convertedCustomers} converted
                customers · {data.verifiedSales} verified sales
              </p>
              <PartnerPerformance data={data} loadPage={setOffset} />
            </>
          )}
          {section === "My Customers" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="mb-3 text-left font-semibold">Attributed customers</caption>
                <thead>
                  <tr>
                    {[
                      "Relationship",
                      "Referred",
                      "Conversion / subscription",
                      "Plan",
                      "Eligibility",
                    ].map((v) => (
                      <th className="p-2 text-left" key={v}>
                        {v}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.customers.map((c) => (
                    <tr key={c.id}>
                      <td className="border-t p-2">{c.id}</td>
                      <td>{new Date(c.signedUpAt).toLocaleDateString()}</td>
                      <td>{c.status}</td>
                      <td>{c.plan}</td>
                      <td>
                        {c.eligible
                          ? "Subject to signed terms and verified payment"
                          : "Pending review"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.customers.length && <p>No referred customers in this page.</p>}
            </div>
          )}
          {section === "Sales" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="mb-3 text-left font-semibold">Verified collected sales</caption>
                <thead>
                  <tr>
                    {[
                      "Sale",
                      "Received",
                      "Collected net revenue",
                      "Refund / dispute adjustments",
                      "Subscription",
                    ].map((v) => (
                      <th key={v} className="p-2 text-left">
                        {v}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.sales.map((s) => (
                    <tr key={s.id}>
                      <td className="border-t p-2">{s.id}</td>
                      <td>{new Date(s.paidAt).toLocaleDateString()}</td>
                      <td>{money(s.netMinor, s.currency)}</td>
                      <td>{money(s.adjustmentMinor, s.currency)}</td>
                      <td>{s.subscriptionStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.sales.length && <p>No verified collected sales in this page.</p>}
            </div>
          )}
          {section === "Referral Links" && (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">Share your referral link</h2>
              {data.referralLink ? (
                <>
                  <label className="block">
                    Referral URL
                    <input
                      className="mt-1 block w-full rounded border bg-background p-3"
                      value={data.referralLink}
                      readOnly
                      onFocus={(e) => e.target.select()}
                    />
                  </label>
                  <Button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(data.referralLink!);
                        setCopied("Referral link copied.");
                      } catch {
                        setCopied("Select the referral URL and copy it manually.");
                      }
                    }}
                  >
                    Copy link
                  </Button>
                  <p role="status">{copied}</p>
                </>
              ) : (
                <p>Referral sharing requires administrator activation.</p>
              )}
              <p>
                {data.totalCustomers} attributed customers · {data.convertedCustomers} customers
                with verified sales.
              </p>
              <p className="text-sm text-muted-foreground">
                A referral visit lasts 30 days. The most recent valid link before verified
                new-account signup is used; confirmed attribution stays fixed. Existing customers
                and self-referrals do not qualify. Upgrades and recurring payments require the
                signed eligibility terms; cancellations stop eligible active-customer counts and
                refunds adjust commissions.
              </p>
            </section>
          )}
          {section === "Performance" && (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">Monthly performance (UTC)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="text-left">
                    Collected revenue and commission after adjustments
                  </caption>
                  <thead>
                    <tr>
                      {["Month", "Currency", "Net revenue", "Commission"].map((h) => (
                        <th className="p-2 text-left" key={h}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.trends.map((t) => (
                      <tr key={`${t.month}-${t.currency}`}>
                        <td className="border-t p-2">{t.month}</td>
                        <td>{t.currency}</td>
                        <td>{money(t.revenue, t.currency)}</td>
                        <td>{money(t.commission, t.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="text-sm">
                {data.monthlyReferrals.map((r) => (
                  <li key={r.month}>
                    {r.month}: {r.referrals} new referrals
                  </li>
                ))}
              </ul>
              {!data.trends.length && <p>No verified monthly revenue yet.</p>}
            </section>
          )}
          {section === "Payouts" && (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">Payouts</h2>
              {Object.entries(data.balances).map(([currency, b]) => (
                <p key={currency}>
                  {currency}: {money(b.approved, currency)} approved · {money(b.paid, currency)}{" "}
                  paid · {money(b.liability, currency)} outstanding
                </p>
              ))}
              <ul>
                {data.payouts.map((p) => (
                  <li className="border-t py-3" key={p.id}>
                    {new Date(p.createdAt).toLocaleDateString()} ·{" "}
                    {money(p.amountMinor, p.currency)} · Completed · {p.reference}
                  </li>
                ))}
              </ul>
              {!data.payouts.length && (
                <p>No completed payouts. Approved balances require administrator settlement.</p>
              )}
            </section>
          )}
          {["My Customers", "Sales"].includes(section) && (
            <div className="flex gap-3">
              <Button
                variant="outline"
                disabled={!offset}
                onClick={() => setOffset(Math.max(0, offset - 50))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={(section === "My Customers" ? data.customers : data.sales).length < 50}
                onClick={() => setOffset(offset + 50)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
