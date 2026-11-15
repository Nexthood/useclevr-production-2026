"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Agreement = {
  signed: false;
  contractId: string;
  role: string;
  email: string;
  legalName: string;
  documentChecksum: string;
  text: string;
  consentVersion: string;
  consentText: string;
  expiresAt: string;
};
const field = "w-full rounded-md border bg-background p-2";
export function NativeSigning() {
  const initialized = useRef(false);
  const ceremony = useRef(0);
  const [token, setToken] = useState(""),
    [email, setEmail] = useState(""),
    [code, setCode] = useState("");
  const [requested, setRequested] = useState(false),
    [agreement, setAgreement] = useState<Agreement | null>(null);
  const [name, setName] = useState(""),
    [consent, setConsent] = useState(false),
    [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [done, setDone] = useState(false);
  async function load() {
    const current = ceremony.current;
    const r = await fetch("/api/partners/contracts/native", { cache: "no-store" });
    const b = await r.json();
    if (!r.ok || current !== ceremony.current) return false;
    if (b.signed) setDone(true);
    else setAgreement(b);
    return true;
  }
  useEffect(() => {
    const open = () => {
      const raw = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
      window.history.replaceState(null, "", window.location.pathname);
      if (raw) {
        ceremony.current++;
        setAgreement(null);
        setDone(false);
        setRequested(false);
        setEmail("");
        setCode("");
        setName("");
        setConsent(false);
        setReviewed(false);
        setBusy(false);
        setMessage("");
        if (/^[A-Za-z0-9_-]{43}$/.test(raw)) setToken(raw);
        else {
          setToken("");
          setMessage(
            "Open your complete signing invitation or contact the partner team for a new one.",
          );
        }
        return;
      }
      load().catch(() => setMessage("Signing is temporarily unavailable. Please retry."));
    };
    if (!initialized.current) {
      initialized.current = true;
      open();
    }
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  async function submit(body: unknown) {
    const current = ceremony.current;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/partners/contracts/native", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const b = await r.json();
      if (current !== ceremony.current) return null;
      if (!r.ok) throw new Error(b.error || "Signing is unavailable.");
      return b;
    } catch (e) {
      if (current === ceremony.current)
        setMessage(e instanceof Error ? e.message : "Request failed. Please retry.");
      return null;
    } finally {
      if (current === ceremony.current) setBusy(false);
    }
  }
  if (done)
    return (
      <p role="status">
        Your signing action is recorded. Both parties receive the completed PDF after company
        countersigning. Commercial activation requires a separate administrator decision.
      </p>
    );
  return (
    <div className="space-y-6">
      <p role="status" aria-live="polite">
        {message}
      </p>
      {!agreement && token && (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const b = await submit(
              requested
                ? { operation: "verify", token, email, code }
                : { operation: "request_code", token, email },
            );
            if (!b) return;
            if (requested) {
              setToken("");
              setCode("");
              if (!(await load()))
                setMessage("Verification completed. Refresh to open your agreement.");
            } else {
              setRequested(true);
              setMessage("Check your email for a six-digit code. It expires in ten minutes.");
            }
          }}
        >
          <p>
            Verify the email address that received this invitation. Email verification grants access
            only to this signing ceremony.
          </p>
          <label className="block">
            Invited email
            <input
              className={field}
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={requested}
            />
          </label>
          {requested && (
            <label className="block">
              Email verification code
              <input
                className={field}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
          )}
          <Button disabled={busy}>
            {requested ? "Verify email and open agreement" : "Send verification code"}
          </Button>
          {requested && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                const b = await submit({ operation: "request_code", token, email });
                if (b) setMessage("Verification code queued. Check your email.");
              }}
            >
              Resend code
            </Button>
          )}
        </form>
      )}
      {!agreement && !token && (
        <p>
          Open your complete signing invitation from email. If your session has expired, contact the
          partner team for a renewed invitation.
        </p>
      )}
      {agreement && (
        <>
          <p>
            Signing as {agreement.role}: {agreement.legalName} · {agreement.email}. Your verified
            signing session expires at {new Date(agreement.expiresAt).toUTCString()}.
          </p>
          <a
            className="underline"
            href="/api/partners/contracts/native?document=source"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open or save the complete agreement PDF
          </a>
          <article
            aria-label="Complete agreement and commercial schedule"
            className="whitespace-pre-wrap break-words rounded-md border p-5 text-sm"
          >
            {agreement.text}
          </article>
          <p className="break-all text-sm text-muted-foreground">
            Agreement SHA-256: {agreement.documentChecksum}
          </p>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const b = await submit({
                operation: "sign",
                signing: {
                  legalName: name,
                  documentChecksum: agreement.documentChecksum,
                  consentVersion: agreement.consentVersion,
                  consent,
                  reviewed,
                  action: "sign_agreement",
                },
              });
              if (b) {
                setDone(true);
                setAgreement(null);
                setName("");
              }
            }}
          >
            <label className="block">
              <input
                required
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />{" "}
              I have reviewed the complete agreement and commercial schedule above.
            </label>
            <p>{agreement.consentText}</p>
            <label className="block">
              <input
                required
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />{" "}
              I explicitly consent to electronic records and signatures and confirm my authority to
              sign.
            </label>
            <label className="block">
              Type your full legal name
              <input
                className={field}
                autoComplete="name"
                required
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <Button disabled={busy || !consent || !reviewed}>
              {agreement.role === "company" ? "Countersign agreement" : "Sign agreement"}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
