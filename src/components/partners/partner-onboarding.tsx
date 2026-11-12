"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function PartnerOnboarding({
  token,
  contractsEnabled = false,
}: {
  token: string;
  contractsEnabled?: boolean;
}) {
  const [accepted, setAccepted] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/partner-applications/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, accepted }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Onboarding could not be completed.");
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Onboarding could not be completed.");
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <div role="status" className="space-y-3">
        <h2 className="text-xl font-semibold">Onboarding complete</h2>
        <p className="leading-7">
          Your application remains Approved. Partner tools, commercial privileges, and commissions
          remain inactive until an administrator separately authorizes activation.
        </p>
        {contractsEnabled && (
          <a
            className="inline-flex min-h-12 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground"
            href="/partners/contracts"
          >
            Continue to partner agreements
          </a>
        )}
      </div>
    );
  return (
    <div className="space-y-5">
      <p className="leading-7 text-muted-foreground">
        This invitation can be used once and must be completed using the verified email address that
        received it. Completing onboarding does not activate your partner account.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <label className="flex items-start gap-3 text-sm leading-6">
        <input
          type="checkbox"
          className="mt-1 size-4"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
        />
        <span>
          I confirm that I’m signed in with the email address on my partner application and agree to
          complete the UseClevr partner onboarding.
        </span>
      </label>
      <Button disabled={!accepted || busy} onClick={submit} className="min-h-12 rounded-xl px-6">
        {busy ? "Completing…" : "Complete onboarding"}
      </Button>
    </div>
  );
}
