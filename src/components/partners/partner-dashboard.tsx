"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { partnerSummary } from "@/lib/partners/store";

export type PartnerSummary = Awaited<ReturnType<typeof partnerSummary>> & { referralLink?: string };
export function money(value: string, currency: string) {
  const digits =
    new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  const amount = BigInt(value),
    sign = amount < BigInt(0) ? "-" : "",
    abs = amount < BigInt(0) ? -amount : amount,
    scale = BigInt(10 ** digits);
  return `${sign}${currency} ${new Intl.NumberFormat("en").format(abs / scale)}${digits ? `.${String(abs % scale).padStart(digits, "0")}` : ""}`;
}
export function PartnerPerformance({
  data,
  loadPage,
}: {
  data: PartnerSummary;
  loadPage?: (offset: number) => void;
}) {
  const progress = data.progress;
  const [page, setPage] = useState(0);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold uppercase">{data.partner.level} partner</h2>
          <p className="text-muted-foreground">
            {data.partner.name} · {data.partner.country}
            {data.partner.market ? ` · ${data.partner.market}` : ""} · {data.partner.status}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold">{data.rateBps / 100}%</p>
          <p className="text-sm text-muted-foreground">Current commission</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Active paying customers", data.activeCustomers],
          ["Total referred customers", data.totalCustomers],
          ["Collected net revenue · rolling 12 months", money(data.rollingUsdMinor, "USD")],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="text-sm">{label}</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold">{value}</CardContent>
          </Card>
        ))}
      </div>
      {progress ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base capitalize">Progress toward {progress.level}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              {progress.unit === "USD minor"
                ? `${money(progress.current, "USD")} / ${money(progress.target, "USD")}`
                : `${progress.current} / ${progress.target} active paying customers`}
            </p>
            <div
              role="progressbar"
              aria-label={`Progress toward ${progress.level}`}
              aria-valuenow={Math.min(100, progress.percent)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="my-3 h-3 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full bg-primary"
                style={{ width: `${Math.min(100, progress.percent)}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {progress.unit === "USD minor"
                ? money(progress.remaining, "USD")
                : `${progress.remaining} customers`}{" "}
              remaining. Revenue levels take precedence.
            </p>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm">Diamond is the highest partner level.</p>
      )}
      {data.referralLink && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
          <label htmlFor="partner-link" className="text-sm font-medium">
            Referral link
          </label>
          <input
            id="partner-link"
            className="min-w-0 flex-1 rounded border bg-background p-2 text-sm"
            value={data.referralLink}
            readOnly
            onFocus={(e) => e.target.select()}
          />
          <Button
            variant="outline"
            onClick={() => navigator.clipboard.writeText(data.referralLink!)}
          >
            Copy link
          </Button>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Amounts use each payment’s currency. Commissions require collected payments, an eligible
        agreement, and policy review. Payment rates are fixed when earned.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="mb-2 text-left font-semibold">Financial summary</caption>
          <thead>
            <tr>
              {[
                "Currency",
                "Collected net revenue",
                "Earned",
                "Pending",
                "Approved",
                "Paid",
                "Adjustments",
                "Outstanding",
              ].map((h) => (
                <th key={h} className="whitespace-nowrap border-b p-2 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.balances).map(([currency, b]) => (
              <tr key={currency}>
                {[
                  currency,
                  ...[
                    b.revenue,
                    b.earned,
                    b.pending,
                    b.approved,
                    b.paid,
                    b.adjustments,
                    b.liability,
                  ].map((v) => money(v, currency)),
                ].map((v, i) => (
                  <td key={i} className="whitespace-nowrap border-b p-2">
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!Object.keys(data.balances).length && (
          <p className="p-3 text-muted-foreground">No qualifying collected payments.</p>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="mb-2 text-left font-semibold">Commission history</caption>
          <thead>
            <tr>
              {["Earned", "Rate", "Amount", "Adjustment", "Outstanding", "Status"].map((h) => (
                <th key={h} className="border-b p-2 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.commissions.slice(page * 20, page * 20 + 20).map((c) => (
              <tr key={c.id}>
                <td className="p-2">{new Date(c.earnedAt).toLocaleDateString()}</td>
                <td className="p-2">{c.rateBps / 100}%</td>
                <td className="p-2">{money(c.amountMinor, c.currency)}</td>
                <td className="p-2">{money(c.adjustedMinor, c.currency)}</td>
                <td className="p-2">{money(c.dueMinor, c.currency)}</td>
                <td className="p-2 capitalize">{c.state}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.commissions.length > 20 && (
        <div className="flex gap-3">
          <Button variant="outline" disabled={!page} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={(page + 1) * 20 >= data.commissions.length}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
      {loadPage && (
        <div className="flex gap-3">
          <Button
            variant="outline"
            disabled={!data.offset}
            onClick={() => loadPage(Math.max(0, data.offset - 50))}
          >
            Newer records
          </Button>
          <Button
            variant="outline"
            disabled={data.nextOffset === null}
            onClick={() => loadPage(data.nextOffset!)}
          >
            Older records
          </Button>
        </div>
      )}
      <details>
        <summary className="cursor-pointer font-medium">
          Payout history ({data.payouts.length})
        </summary>
        <ul className="mt-3 space-y-2 text-sm">
          {data.payouts.map((p) => (
            <li key={p.id}>
              {new Date(p.createdAt).toLocaleDateString()} · {money(p.amountMinor, p.currency)} ·{" "}
              {p.reference}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
export function PartnerDashboard() {
  const [data, setData] = useState<PartnerSummary | null>(null),
    [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    let alive = true;
    fetch(`/api/partners?offset=${offset}`, { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        if (alive) setData(body);
      })
      .catch((e) => {
        if (alive) setError(e.message || "Partner information is unavailable.");
      });
    return () => {
      alive = false;
    };
  }, [offset]);
  if (error)
    return (
      <p role="alert" className="rounded border border-destructive p-4">
        {error}
      </p>
    );
  return data ? (
    <PartnerPerformance key={data.offset} data={data} loadPage={setOffset} />
  ) : (
    <p role="status">Loading partner information…</p>
  );
}
