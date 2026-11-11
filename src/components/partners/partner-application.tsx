"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const sales = ["Independent Sales Partner", "Referral Partner"];
const enterprise = ["Authorized Reseller", "MSP", "System Integrator", "Business Consultancy", "Enterprise Solution Partner", "Strategic Distribution Partner", "White-Label Inquiry"];
const field = "w-full rounded-xl border border-border bg-background px-4 py-3 text-base outline-none transition focus-visible:ring-2 focus-visible:ring-ring";

export function PartnerApplication({ partnershipType, program: initialProgram }: { partnershipType?: string; program?: string }) {
  const [program, setProgram] = useState(initialProgram === "reseller_enterprise" || enterprise.includes(partnershipType || "") ? "reseller_enterprise" : "work_with_us");
  const options = program === "work_with_us" ? sales : enterprise;
  const suggested = options.includes(partnershipType || "") ? partnershipType! : options[0];
  const [category, setCategory] = useState(suggested);
  const [startedAt] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/partner-applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        program, category, fullName: values.get("fullName"), email: values.get("email"), country: values.get("country"), companyName: values.get("companyName"), experience: values.get("experience"), privacyAccepted: values.get("privacyAccepted") === "on", website: values.get("website"), formStartedAt: startedAt,
      }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We could not submit the application. Please try again.");
      setSuccess(true); form.reset();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We could not submit the application. Please try again."); }
    finally { setBusy(false); }
  }
  if (success) return <section role="status" aria-live="polite" className="rounded-2xl border border-emerald-700/30 bg-emerald-500/10 p-6 sm:p-8"><h2 className="text-2xl font-semibold">Application received</h2><p className="mt-3 leading-7">Your application is pending administrator review. We’ll send a confirmation to your business email. No UseClevr customer account is needed to apply.</p></section>;
  return <div className="space-y-6">
    <p className="text-base leading-7 text-muted-foreground">Tell us about your business and how you’d like to work with UseClevr. Applications are reviewed by our partner team; submitting an application does not authorize reselling or activate commissions.</p>
    {error && <p role="alert" className="rounded-xl border border-destructive p-4 text-destructive">{error}</p>}
    <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
      <label className="space-y-2 text-sm font-medium">Partner program<select className={field} value={program} onChange={(e) => { const value=e.target.value; setProgram(value); setCategory(value === "work_with_us" ? sales[0] : enterprise[0]); }}><option value="work_with_us">Work With Us</option><option value="reseller_enterprise">Reseller & Enterprise</option></select></label>
      <label className="space-y-2 text-sm font-medium">Partner category<select name="category" className={field} value={category} onChange={(e) => setCategory(e.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>
      <label className="space-y-2 text-sm font-medium">Full name<input name="fullName" required minLength={2} maxLength={200} autoComplete="name" className={field} /></label>
      <label className="space-y-2 text-sm font-medium">Business email<input name="email" required type="email" maxLength={254} autoComplete="email" className={field} /></label>
      <label className="space-y-2 text-sm font-medium">Country <span className="font-normal text-muted-foreground">(two-letter code, e.g. NL)</span><input name="country" required pattern="[A-Za-z]{2}" maxLength={2} autoComplete="country" className={field} /></label>
      <label className="space-y-2 text-sm font-medium">Company name <span className="font-normal text-muted-foreground">(optional)</span><input name="companyName" maxLength={200} autoComplete="organization" className={field} /></label>
      <label className="space-y-2 text-sm font-medium sm:col-span-2">Relevant experience or business description<textarea name="experience" required minLength={20} maxLength={4000} rows={5} className={field} /></label>
      <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"><label>Leave this field empty<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <label className="flex items-start gap-3 text-sm leading-6 sm:col-span-2"><input name="privacyAccepted" type="checkbox" required className="mt-1 size-4 accent-primary" /><span>I have read and agree to the <a className="underline underline-offset-4" href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.</span></label>
      <div className="sm:col-span-2"><Button type="submit" disabled={busy} className="min-h-12 w-full rounded-xl px-6 text-base font-semibold sm:w-auto">{busy ? "Submitting…" : "Submit partner application"}</Button><p className="mt-3 text-sm text-muted-foreground">Your application will be stored as Pending for administrator review.</p></div>
    </form>
  </div>;
}
