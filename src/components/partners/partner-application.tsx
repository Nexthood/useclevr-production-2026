"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  applicationStatusText,
  partnershipTypes,
  partnerPrivacyVersion,
  type ApplicationReceipt,
} from "@/lib/partners/application";

export function PartnerApplication({ partnershipType }: { partnershipType?: string }) {
  const [selectedType, setSelectedType] = useState(
    partnershipTypes.find((t) => t === partnershipType) || "",
  );
  const [receipt, setReceipt] = useState<ApplicationReceipt | null>(null);
  const company = !!selectedType || !!receipt?.partnershipType;
  const [statusError, setStatusError] = useState(false);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    fetch("/api/partners", { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 404) return;
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "Unable to check application status.");
        if (alive)
          setReceipt(
            body.application || {
              status: body.partner.status,
              name: body.partner.name,
              createdAt: "",
            },
          );
      })
      .catch((e) => {
        if (alive) {
          setError(e.message);
          setStatusError(true);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(company
            ? {
                partnershipType: values.get("partnershipType"),
                companyName: values.get("companyName"),
                businessEmail: values.get("businessEmail"),
                companyWebsite: values.get("companyWebsite"),
                industry: values.get("industry"),
                existingCustomers: Number(values.get("existingCustomers")),
                websiteConfirmation: values.get("websiteConfirmation"),
              }
            : { market: values.get("market") }),
          name: values.get("name"),
          country: String(values.get("country")).trim().toUpperCase(),
          experience: values.get("experience"),
          privacyAccepted: values.get("privacyAccepted") === "on",
          termsAccepted: values.get("termsAccepted") === "on",
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Application could not be submitted.");
      setReceipt(body.application);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Application could not be submitted.");
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <p role="status">Checking your application…</p>;
  if (receipt)
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold capitalize">
          {receipt.status === "active"
            ? "Approved"
            : receipt.status === "pending"
              ? "Pending review"
              : receipt.status}
        </h2>
        <p role="status">
          {applicationStatusText[receipt.status] ||
            "Your partnership is approved. Open your dashboard to get your referral link and track eligible commissions."}
        </p>
        {receipt.createdAt && <p>Submitted {new Date(receipt.createdAt).toLocaleDateString()}</p>}
        {!company && (
          <a className="underline" href="/app/partners">
            Open partner dashboard
          </a>
        )}
        {" · "}
        <a className="underline" href="/app/tickets/new">
          Contact support
        </a>
      </div>
    );
  return (
    <div className="space-y-5">
      <p>
        Apply using your verified UseClevr account. We use your account email to identify and
        contact you. Each account can submit one application. Approval requires administrator
        review.
      </p>
      {error && (
        <p role="alert" className="rounded border border-destructive p-3">
          {error}{" "}
          <a className="underline" href="/partners/apply">
            Check status again
          </a>
        </p>
      )}
      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1 text-sm">
          <span>Partnership type</span>
          <select
            name="partnershipType"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="block w-full rounded border bg-background p-2"
          >
            <option value="">Independent Sales Partner</option>
            {partnershipTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        {company && (
          <>
            <label className="block space-y-1 text-sm">
              <span>Company name</span>
              <input
                name="companyName"
                required
                minLength={2}
                maxLength={200}
                autoComplete="organization"
                className="block w-full rounded border bg-background p-2"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Business email (must match your verified account email)</span>
              <input
                name="businessEmail"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                className="block w-full rounded border bg-background p-2"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Company website</span>
              <input
                name="companyWebsite"
                type="url"
                required
                maxLength={500}
                placeholder="https://company.com"
                autoComplete="url"
                className="block w-full rounded border bg-background p-2"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Industry</span>
              <input
                name="industry"
                required
                minLength={2}
                maxLength={200}
                className="block w-full rounded border bg-background p-2"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Estimated number of existing business customers</span>
              <input
                name="existingCustomers"
                type="number"
                required
                min={0}
                max={100000000}
                step={1}
                className="block w-full rounded border bg-background p-2"
              />
            </label>
            <div hidden aria-hidden="true">
              <label>
                Leave empty
                <input name="websiteConfirmation" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
          </>
        )}
        {[
          ["name", company ? "Contact person" : "Full name", 200],
          ["country", "Country of residence (two-letter ISO code, e.g. NL)", 2],
          ...(!company ? [["market", "Target market and languages", 200]] : []),
        ].map(([name, label, max]) => (
          <label key={name} className="block space-y-1 text-sm">
            <span>{label}</span>
            <input
              name={String(name)}
              required
              maxLength={Number(max)}
              minLength={2}
              autoComplete={name === "name" ? "name" : name === "country" ? "country" : "off"}
              className="block w-full rounded border bg-background p-2"
            />
          </label>
        ))}
        <label className="block space-y-1 text-sm">
          <span>
            {company
              ? "Short description of partnership interest (20–4,000 characters)"
              : "Your experience and how you plan to introduce UseClevr to businesses (20–4,000 characters)"}
          </span>
          <textarea
            name="experience"
            required
            minLength={20}
            maxLength={4000}
            rows={5}
            className="block w-full rounded border bg-background p-2"
          />
        </label>
        <div className="space-y-2 rounded border p-4 text-sm">
          <h2 className="font-semibold">Application privacy notice · {partnerPrivacyVersion}</h2>
          <p>
            UseClevr stores your account identity, application details, submission date and
            acknowledgments to review your application, manage your partnership and maintain an
            audit record. Authorized administrators can review these records. Do not include
            customer information or sensitive personal information in your application. See the{" "}
            <a className="underline" href="/privacy" target="_blank" rel="noreferrer">
              Privacy Policy
            </a>{" "}
            for retention, contact and privacy rights.
          </p>
          <label className="flex gap-2">
            <input type="checkbox" name="privacyAccepted" required />
            <span>I have read the application privacy notice and Privacy Policy.</span>
          </label>
        </div>
        <div className="space-y-2 rounded border p-4 text-sm">
          <h2 className="font-semibold">Program terms</h2>
          {company ? (
            <p>
              Flexible Partnership Terms: partner margins, enterprise licensing arrangements, and
              commercial conditions are tailored to each partnership. There is no mandatory upfront
              partner enrollment fee, guaranteed earnings, automatic exclusive territory or
              automatic reseller authorization. Applications enter pending review. Application
              approval does not activate commissions or authorize reselling. A separately reviewed
              commercial agreement and onboarding are required. White-label and custom integration
              inquiries concern future opportunities, subject to feasibility and agreement.
            </p>
          ) : (
            <>
              <p>
                This is an independent partnership, subject to review and an approved agreement.
                Bronze (0–24 customers) and Silver (25–99) earn 15%; Gold (100+) earns 20%. Platinum
                (USD 100,000) and Diamond (USD 300,000) in attributable rolling 12-month collected
                net revenue earn 20% and take precedence. Commission covers eligible collected net
                revenue after discounts and excluding taxes for up to 12 calendar months from each
                customer’s first successful payment. Related-party purchases are excluded. A
                continuous 30-day downgrade grace applies.
              </p>
              <p>
                Commission requires a 30-day wait, manual approval and a USD 50 or EUR 50 eligible
                balance in its own currency. Other currencies require an approved threshold.
                Suspension holds accrual; termination stops accrual. Refunds and disputes can
                reverse commissions, including same-currency offsets after payout. Participation,
                income and payment dates are not guaranteed. Your approved agreement records
                participation and settlement arrangements.
              </p>
            </>
          )}
          <label className="flex gap-2">
            <input type="checkbox" name="termsAccepted" required />
            <span>
              I accept these program terms and the{" "}
              <a className="underline" href="/terms" target="_blank" rel="noreferrer">
                Terms of Service
              </a>
              , and confirm my application is accurate.
            </span>
          </label>
        </div>
        <Button disabled={busy || statusError}>
          {busy ? "Submitting application…" : "Submit application"}
        </Button>
      </form>
    </div>
  );
}
