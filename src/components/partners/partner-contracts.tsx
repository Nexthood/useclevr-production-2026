"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  contractDocument,
  contractLabels,
  type ContractData,
  type ContractItem,
} from "./contract-types";
import { SubmissionConfirmation } from "./submission-confirmation";

type ContractProfile = ContractData["profiles"][number];
const signingMessages: Record<NonNullable<ContractItem["signingAvailability"]>, string> = {
  approval_pending: "Your agreement is awaiting approval from the UseClevr Partner Team.",
  disabled:
    "Online signing is currently unavailable. The UseClevr Partner Team will email you about the next step.",
  invitation_pending:
    "Your secure signing invitation is pending. Check your email for the invitation when it is ready.",
  invitation_unavailable:
    "Your signing invitation is unavailable or expired. Contact the UseClevr Partner Team for help.",
  invitation_ready:
    "Open the secure signing invitation in your email to review and sign your agreement.",
  delivery_issue:
    "We could not confirm delivery of your signing invitation. Contact the UseClevr Partner Team for help.",
};
const field = "mt-1 w-full rounded-md border bg-background p-2";
export function PartnerContracts() {
  const [data, setData] = useState<ContractData | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [password, setPassword] = useState(""),
    [setup, setSetup] = useState("");
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [identityError, setIdentityError] = useState<{ id: string; message: string } | null>(null);
  const identitySubmissionLocked = useRef(false);
  const loadVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    const response = await fetch("/api/partners/contracts", { cache: "no-store" });
    const result = await response.json();
    if (version !== loadVersion.current) return;
    if (!response.ok) {
      throw new Error(
        result.code === "contract_management_disabled"
          ? "Agreement management is currently unavailable. The UseClevr Partner Team will email you about the next step."
          : result.error || "We could not load your agreement status. Please try again.",
      );
    }
    setData(result);
  }, []);

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, [load]);

  async function submitIdentity(event: FormEvent<HTMLFormElement>, applicationId: string) {
    event.preventDefault();
    if (identitySubmissionLocked.current) return;
    identitySubmissionLocked.current = true;
    // A status read started before submission must not replace the saved profile.
    loadVersion.current++;
    setBusy(true);
    setMessage("");
    setIdentityError(null);
    const values = new FormData(event.currentTarget);
    const text = (key: string) => String(values.get(key) || "").trim();
    const registrationId = text("registrationId");
    const fallback = "We could not submit your legal information. Please try again.";
    try {
      const response = await fetch("/api/partners/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          identity: {
            legalName: text("legalName"),
            entityType: text("entityType"),
            address: text("address"),
            country: text("country").toUpperCase(),
            ...(registrationId ? { registrationId } : {}),
            signerName: text("signerName"),
            signerTitle: text("signerTitle"),
            authorityConfirmed: values.get("authorityConfirmed") === "on",
            electronicRecordsConsent: values.get("electronicRecordsConsent") === "on",
          },
        }),
      });
      const saved = await response.json().catch(() => null);
      if (!response.ok || saved?.applicationId !== applicationId || !saved.id || !saved.identity)
        throw new Error(saved?.error || fallback);
      setData(
        (current) =>
          current && {
            ...current,
            profiles: [saved, ...current.profiles.filter((profile) => profile.id !== saved.id)],
          },
      );
      setConfirmation(applicationId);
    } catch (error) {
      identitySubmissionLocked.current = false;
      setIdentityError({
        id: applicationId,
        message: error instanceof Error ? error.message : fallback,
      });
    } finally {
      setBusy(false);
    }
  }

  function acknowledgeIdentity(applicationId: string) {
    identitySubmissionLocked.current = false;
    setConfirmation(null);
    requestAnimationFrame(() =>
      document.getElementById(`agreement-status-${applicationId}`)?.focus(),
    );
    load().catch((error) => setMessage(error.message));
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Review your legal identity and agreement. You receive a separate secure signing invitation
        by email. Commercial access requires a final administrator decision.
      </p>
      <p role="status">{message}</p>
      {data?.applications
        .filter((a) => a.onboardedAt)
        .map((a) => {
          const profile = data.profiles.find((profile) => profile.applicationId === a.id);
          const contracts = data.contracts.filter((contract) => contract.applicationId === a.id);
          const agreement = contracts[0];
          return (
            <section key={a.id} className="space-y-4 border-t pt-5">
              <h2 className="text-xl font-semibold">
                {a.fullName} · {a.category}
              </h2>
              <div
                id={`agreement-status-${a.id}`}
                tabIndex={-1}
                role="status"
                className="space-y-1 rounded-lg border bg-card p-4 focus-visible:outline-2 focus-visible:outline-ring"
              >
                {profile && !profile.reviewedAt ? (
                  <>
                    <p className="font-semibold">Status: Pending Review</p>
                    <p>
                      Your information is being reviewed by the UseClevr Partner Team. We will
                      notify you by email when the next step is available.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold">
                      {agreement
                        ? `Status: ${contractLabels[agreement.status] || "Agreement Under Review"}`
                        : profile
                          ? "Status: Agreement Under Review"
                          : "Status: Legal Information Required"}
                    </p>
                    {agreement?.signingAvailability ? (
                      <p>{signingMessages[agreement.signingAvailability]}</p>
                    ) : (
                      !agreement && (
                        <p>
                          {profile
                            ? "The UseClevr Partner Team will email you when the next step is available."
                            : "Submit your legal information to begin agreement review."}
                        </p>
                      )
                    )}
                  </>
                )}
              </div>
              {contracts.map((c) => (
                <div key={c.id} className="space-y-2">
                  <p>
                    {contractLabels[c.status]} · Revision {c.revision}
                    {!["dropbox_live", "native"].includes(c.mode)
                      ? " · Non-binding test / draft"
                      : ""}
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
              <LegalIdentityForm
                key={profile?.id || a.id}
                profile={profile}
                busy={busy}
                confirmationOpen={confirmation !== null}
                error={identityError?.id === a.id ? identityError.message : undefined}
                onSubmit={(event) => submitIdentity(event, a.id)}
              />
            </section>
          );
        })}
      {confirmation && (
        <SubmissionConfirmation
          open
          title="Information Submitted Successfully!"
          onDone={() => acknowledgeIdentity(confirmation)}
        >
          <p>Your legal information has been submitted for review.</p>
          <p>
            Our team will verify your details and contact you by email regarding the next steps.
          </p>
        </SubmissionConfirmation>
      )}
      {data?.contracts.some(
        (c) => c.status === "fully_executed" && ["dropbox_live", "native"].includes(c.mode),
      ) && (
        <section className="space-y-3 border-t pt-5">
          <h2 className="text-xl font-semibold">Set up partner login</h2>
          <p>
            Use your existing login if you already have a verified UseClevr identity. New partners
            can create a password here. Commercial privileges require administrator activation.
          </p>
          <a className="underline" href="/partner/login">
            Sign in to the partner portal
          </a>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setSetup("");
              try {
                const r = await fetch("/api/partner-applications/credentials", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ password }),
                });
                const b = await r.json();
                if (!r.ok) throw new Error(b.error);
                setPassword("");
                setSetup(
                  b.existingLogin
                    ? "Use your existing login to enter the partner portal."
                    : "Password saved. Sign in to the partner portal.",
                );
              } catch (e) {
                setSetup(e instanceof Error ? e.message : "Account setup failed. Please retry.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="block">
              New password
              <input
                type="password"
                autoComplete="new-password"
                required
                maxLength={200}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={field}
              />
            </label>
            <Button disabled={busy}>Save partner password</Button>
          </form>
          <p role="status">{setup}</p>
        </section>
      )}
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

function LegalIdentityForm({
  profile,
  busy,
  confirmationOpen,
  error,
  onSubmit,
}: {
  profile?: ContractProfile;
  busy: boolean;
  confirmationOpen: boolean;
  error?: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [entityType, setEntityType] = useState(profile?.identity.entityType || "company");
  return (
    <details open={!profile}>
      <summary>
        {profile ? "View or update legal identity" : "Submit legal identity and signing authority"}
      </summary>
      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={onSubmit}
        aria-busy={busy}
        inert={confirmationOpen}
      >
        <label>
          Entity type
          <select
            name="entityType"
            className={field}
            value={entityType}
            onChange={(event) =>
              setEntityType(event.target.value === "company" ? "company" : "individual")
            }
          >
            <option value="company">Company</option>
            <option value="individual">Individual</option>
          </select>
        </label>
        {(
          [
            ["legalName", "Full legal name", 2, 200],
            ["address", "Registered or legal address", 10, 1000],
            ["country", "Country (two-letter code)", 2, 2],
            [
              "registrationId",
              `Company registration (${entityType === "company" ? "required" : "optional"})`,
              1,
              200,
            ],
            ["signerName", "Authorized signer's full name", 2, 200],
            ["signerTitle", "Signer's title or capacity", 1, 200],
          ] as const
        ).map(([name, title, minimum, maximum]) => (
          <label key={name}>
            {title}
            <input
              name={name}
              defaultValue={profile?.identity[name]}
              required={name !== "registrationId" || entityType === "company"}
              minLength={minimum}
              maxLength={maximum}
              pattern={name === "country" ? "[A-Za-z]{2}" : undefined}
              className={field}
            />
          </label>
        ))}
        <label className="text-sm sm:col-span-2">
          <input name="authorityConfirmed" required type="checkbox" /> I confirm this information is
          accurate and I have authority to enter an agreement for this party.
        </label>
        <div className="space-y-2 text-sm sm:col-span-2">
          <p>
            Electronic records disclosure: agreements are provided in English as PDF files. You need
            a current browser, email access and a PDF reader; save or print copies for your records.
            You can download your agreements from this portal. Signing takes place through the
            approved email-verified signing workflow. Signing alone does not enable commercial
            access.
          </p>
          <p>
            Before signing, you may decline electronic delivery, request a paper copy or assistance,
            or update your email through the partner team using the contact details on your
            agreement. Withdrawal of consent does not invalidate an agreement already executed;
            alternative arrangements require company confirmation.
          </p>
          <label>
            <input name="electronicRecordsConsent" required type="checkbox" /> I can access and
            retain PDF records and consent to electronic agreements, signatures and delivery.
          </label>
        </div>
        {error && (
          <p role="alert" className="text-destructive sm:col-span-2">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Submitting…" : "Submit identity for review"}
        </Button>
      </form>
    </details>
  );
}
