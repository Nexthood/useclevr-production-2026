"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
export function InvitationOnboarding({ token }: { token: string }) {
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(action: "request_code" | "verify") {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/partner-applications/invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, token, email, ...(action === "verify" ? { code } : {}) }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Verification is unavailable. Please retry.");
      if (action === "verify") window.location.assign("/partners/contracts");
      else setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification is unavailable. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <p className="leading-7 text-muted-foreground">
        Verify the email address that received this invitation, then review and sign your partner
        agreement. Set up partner login credentials after signing. No customer signup, subscription
        or payment is required.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(sent ? "verify" : "request_code");
        }}
      >
        <label className="block space-y-2">
          Invited email address
          <input
            type="email"
            required
            autoComplete="email"
            maxLength={254}
            className="block w-full rounded border bg-background p-3"
            value={email}
            readOnly={sent}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {sent && (
          <>
            <p role="status">
              Check your email for a six-digit code. The code expires in 10 minutes.
            </p>
            <label className="block space-y-2">
              Verification code
              <input
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                className="block w-full rounded border bg-background p-3"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
          </>
        )}
        <Button disabled={busy} type="submit">
          {busy ? "Please wait…" : sent ? "Verify email and continue" : "Send verification code"}
        </Button>
        {sent && (
          <div className="flex gap-4">
            <Button
              variant="outline"
              disabled={busy}
              type="button"
              onClick={() => submit("request_code")}
            >
              Resend code
            </Button>
            <Button
              variant="ghost"
              type="button"
              disabled={busy}
              onClick={() => {
                setSent(false);
                setCode("");
              }}
            >
              Change email
            </Button>
          </div>
        )}
      </form>
      <p className="text-sm text-muted-foreground">
        Already verified on this browser?{" "}
        <a className="underline" href="/partners/contracts">
          Continue to agreements
        </a>
        . For an expired or used invitation, contact the partner team using your invitation email.
      </p>
    </div>
  );
}
