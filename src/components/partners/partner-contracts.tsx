"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { contractDocument, contractLabels, type ContractData } from "./contract-types";
const field = "mt-1 w-full rounded-md border bg-background p-2";
export function PartnerContracts() {
  const [data, setData] = useState<ContractData | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const r = await fetch("/api/partners/contracts", { cache: "no-store" });
    const b = await r.json();
    if (!r.ok) throw new Error(b.error);
    setData(b);
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Review your legal identity and agreement. The signature provider sends a separate secure
        signing invitation. Commercial access requires a final administrator decision.
      </p>
      <p role="status">{message}</p>
      {data?.applications
        .filter((a) => a.onboardedAt)
        .map((a) => (
          <section key={a.id} className="space-y-4 border-t pt-5">
            <h2 className="text-xl font-semibold">
              {a.fullName} · {a.category}
            </h2>
            {data.contracts
              .filter((c) => c.applicationId === a.id)
              .map((c) => (
                <div key={c.id} className="space-y-2">
                  <p>
                    {contractLabels[c.status]} · Revision {c.revision}
                    {c.mode !== "dropbox_live" ? " · Non-binding test / draft" : ""}
                  </p>
                  <p className="text-sm">
                    Partner signature: {c.partnerSignedAt ? "Completed" : "Pending"} · Company
                    signature: {c.companySignedAt ? "Completed" : "Pending"}
                  </p>
                  <p className="text-sm">
                    Commercial status:{" "}
                    {c.partnerStatus === "active"
                      ? "Active"
                      : c.readyForActivation
                        ? "Ready for Activation"
                        : "Pending"}
                  </p>
                  <div className="flex gap-4 text-sm">
                    {c.sourceAvailable && (
                      <a className="underline" href={contractDocument(c.id, "source")}>
                        Download agreement for review
                      </a>
                    )}
                    {c.signedAvailable && (
                      <a className="underline" href={contractDocument(c.id, "signed")}>
                        Download completed PDF
                      </a>
                    )}
                  </div>
                </div>
              ))}
            <details open={!data.profiles.some((p) => p.applicationId === a.id)}>
              <summary>Submit legal identity and signing authority</summary>
              <form
                className="mt-4 grid gap-4 sm:grid-cols-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setMessage("");
                  const f = new FormData(e.currentTarget),
                    s = (k: string) => String(f.get(k) || "");
                  try {
                    const r = await fetch("/api/partners/contracts", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        applicationId: a.id,
                        identity: {
                          legalName: s("legalName"),
                          entityType: s("entityType"),
                          address: s("address"),
                          country: s("country"),
                          ...(s("registrationId") ? { registrationId: s("registrationId") } : {}),
                          signerName: s("signerName"),
                          signerTitle: s("signerTitle"),
                          authorityConfirmed: true,
                          electronicRecordsConsent: true,
                        },
                      }),
                    });
                    const b = await r.json();
                    if (!r.ok) throw new Error(b.error);
                    setMessage("Identity submitted for administrator review.");
                    await load();
                  } catch (e) {
                    setMessage(e instanceof Error ? e.message : "Submission failed.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  Entity type
                  <select name="entityType" className={field}>
                    <option value="company">Company</option>
                    <option value="individual">Individual</option>
                  </select>
                </label>
                {[
                  ["legalName", "Full legal name"],
                  ["address", "Registered or legal address"],
                  ["country", "Country (two-letter code)"],
                  ["registrationId", "Company registration (required for companies)"],
                  ["signerName", "Authorized signer's full name"],
                  ["signerTitle", "Signer's title or capacity"],
                ].map(([name, title]) => (
                  <label key={name}>
                    {title}
                    <input
                      name={name}
                      required={name !== "registrationId"}
                      maxLength={name === "address" ? 1000 : 200}
                      className={field}
                    />
                  </label>
                ))}
                <label className="text-sm sm:col-span-2">
                  <input required type="checkbox" /> I confirm this information is accurate and I
                  have authority to enter an agreement for this party.
                </label>
                <div className="space-y-2 text-sm sm:col-span-2">
                  <p>
                    Electronic records disclosure: agreements are provided in English as PDF files.
                    You need a current browser, email access and a PDF reader; save or print copies
                    for your records. You can download your agreements from this portal. Signing
                    takes place with the approved electronic signature provider. Signing alone does
                    not enable commercial access.
                  </p>
                  <p>
                    Before signing, you may decline electronic delivery, request a paper copy or
                    assistance, or update your email through the partner team using the contact
                    details on your agreement. Withdrawal of consent does not invalidate an
                    agreement already executed; alternative arrangements require company
                    confirmation.
                  </p>
                  <label>
                    <input required type="checkbox" /> I can access and retain PDF records and
                    consent to electronic agreements, signatures and delivery.
                  </label>
                </div>
                <Button disabled={busy}>Submit identity for review</Button>
              </form>
            </details>
          </section>
        ))}
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => load().catch((e) => setMessage(e.message))}
      >
        Refresh agreement status
      </Button>
    </div>
  );
}
