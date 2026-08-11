import { PublicFooter } from "@/components/layout/public-footer"
import { PublicHeader } from "@/components/layout/public-header"
import { Card } from "@/components/ui/card"
import { Cookie, Database, LockKeyhole, Mail, ShieldCheck } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

const LAST_UPDATED = "August 10, 2026"

const privacySections = [
  {
    title: "Information Collected",
    body: "UseClevr collects the information needed to create accounts, verify identity, provide the service, process payments, secure the platform, support customers, and improve product quality for users worldwide. This can include name, email address, company details, role, country or region, plan, usage events, support messages, device and browser metadata, uploaded filenames or dataset metadata, and operational logs.",
  },
  {
    title: "Cookies",
    body: "UseClevr uses cookies and similar technologies for authentication, session continuity, preferences, security, analytics, and product reliability. You can control cookies through your browser settings, but some account and security features may not work correctly without required cookies.",
  },
  {
    title: "Authentication",
    body: "UseClevr processes account credentials, session tokens, access roles, and related security records to authenticate users and protect accounts. Passwords and verification flows are handled through secure server-side systems and are not exposed to other users.",
  },
  {
    title: "Email Verification",
    body: "UseClevr may send verification codes, password reset messages, security notices, billing notices, and account emails. Verification codes are used to confirm access to an email address and protect the account from unauthorized use.",
  },
  {
    title: "Stripe Payments",
    body: "UseClevr uses Stripe or another payment provider to process subscription checkout, recurring billing, invoices, payment status, taxes, fraud prevention, currency handling, and related account updates for customers in supported countries. UseClevr does not store full payment card numbers. Payment processing is subject to the payment provider's own privacy, security, and compliance practices.",
  },
  {
    title: "Uploaded Datasets",
    body: "Uploaded CSV, Excel, and related business datasets remain your content. Uploading a dataset does not transfer ownership of that dataset to UseClevr. UseClevr processes uploaded datasets only as reasonably needed to host, process, analyze, secure, transmit where necessary, display, generate requested outputs, provide the service, profile columns, calculate metrics, generate dashboards, detect risks and opportunities, produce reports, and support customer-requested workflows. You are responsible for ensuring you have the right to upload and process the data.",
  },
  {
    title: "AI Processing",
    body: "UseClevr may use configured AI providers, cloud AI, or local/private provider routing to explain analysis results, summarize datasets, generate recommendations, and support chat workflows. Depending on your settings, plan, provider configuration, and requested functionality, AI processing may occur locally, through UseClevr systems, or through providers located in different countries. UseClevr aims to send only the limited context needed for the requested functionality, such as prompts, derived dataset context, summaries, column profiles, calculated metrics, bounded samples, or other relevant analysis context. Ghost Mode minimizes UseClevr retention for AI conversations by skipping normal conversation history and content-level AI traces while retaining technically necessary operational, billing, security, and provider-routing metadata. Deterministic calculations may remain backend-side where applicable, and AI-generated explanations may use derived dataset context rather than every raw row. AI outputs may contain errors and are not guaranteed to be complete, current, or error-free. Relevant provider processing may also be subject to the provider's service, privacy, security, and data-processing arrangements.",
  },
  {
    title: "Data Retention",
    body: "UseClevr keeps account, billing, dataset, report, audit, and operational records for as long as needed to provide the service, meet legal obligations, resolve disputes, enforce terms, maintain security, and support customer workflows. Retention periods may vary by data type and plan configuration.",
  },
  {
    title: "Security",
    body: "UseClevr applies role-based access controls, transport encryption, server-side secret handling, operational logging, and administrative safeguards designed to protect account and dataset information. No internet-connected service can guarantee absolute security, but UseClevr works to reduce risk and respond to issues promptly.",
  },
  {
    title: "GDPR, EU, and UK GDPR",
    body: "Where the EU GDPR or UK GDPR applies, UseClevr processes personal data under appropriate legal bases such as contract performance, legitimate interests, consent where required, and legal obligations. UseClevr supports applicable rights such as access, correction, deletion, restriction, objection, portability, and withdrawal of consent where processing is based on consent. International transfers are handled using appropriate safeguards where required.",
  },
  {
    title: "CCPA and CPRA for California",
    body: "Where the California Consumer Privacy Act as amended by the California Privacy Rights Act applies, California residents may have rights to know, access, correct, delete, and receive information about certain personal information practices, and rights related to sale, sharing, sensitive personal information, and non-discrimination. UseClevr does not intend to sell personal information. Requests can be sent to start@useclevr.com and may require identity verification.",
  },
  {
    title: "General US Privacy and Business Terms",
    body: "For users in the United States, UseClevr processes account, billing, security, support, analytics, and uploaded business data to provide SaaS services, prevent fraud, maintain platform reliability, and support subscriptions. State privacy rights may vary, and UseClevr responds to applicable requests according to the law that applies to the user, organization, and data.",
  },
  {
    title: "International Users and Cross-Border Processing",
    body: "UseClevr is intended for a worldwide market. Your information may be processed in countries other than where you live or operate, including countries where UseClevr, hosting providers, analytics providers, AI providers, payment providers, support tools, or security vendors maintain systems. Those countries may have data-protection laws that differ from your local laws, and UseClevr uses contractual, technical, and organizational safeguards where required.",
  },
  {
    title: "User Rights",
    body: "Depending on your jurisdiction, you may have rights to access, correct, delete, export, restrict, object to, or opt out of certain processing of personal data. You may also have the right to withdraw consent where processing is based on consent, appeal a privacy decision where local law provides that right, or use an authorized agent where permitted. Requests can be sent to start@useclevr.com and may require identity verification.",
  },
  {
    title: "Legal Review Notice",
    body: "This Privacy Policy is intended as a general SaaS legal framework and should be reviewed by a qualified legal professional before large-scale commercial launch. Privacy obligations differ by country, customer type, industry, dataset content, and processing role.",
  },
  {
    title: "Contact Information",
    body: "Questions about privacy, data protection, account data, deletion, or user rights can be sent to start@useclevr.com.",
  },
]

export const metadata: Metadata = {
  title: "Privacy Policy | UseClevr",
  description: "Read the global UseClevr Privacy Policy covering account data, cookies, authentication, email verification, Stripe payments, datasets, AI processing, GDPR, UK GDPR, CCPA, CPRA, international users, and user rights.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy | UseClevr",
    description: "How UseClevr handles account data, uploaded datasets, AI processing, billing, cookies, global privacy rights, retention, security, and cross-border processing.",
    url: "/privacy",
    siteName: "UseClevr",
    type: "website",
  },
}

export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PublicHeader />
      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-cyan-200/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.98))]">
          <div className="container mx-auto px-4 py-16 md:px-6 md:py-20">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-200/30 bg-cyan-200/10 px-4 py-2 text-sm font-medium text-cyan-100">
                <LockKeyhole className="h-4 w-4" />
                Privacy
              </div>
              <h1 className="text-4xl font-bold tracking-tight md:text-6xl">Privacy Policy</h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                How UseClevr collects, protects, and processes account information, uploaded datasets, billing data, AI analysis context, and privacy rights for users worldwide.
              </p>
              <p className="mt-4 text-sm font-medium text-cyan-100">Last Updated: {LAST_UPDATED}</p>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-12 md:px-6 md:py-16">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[280px_1fr]">
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <Card className="border-cyan-200/15 bg-card/80 p-5 shadow-[0_20px_80px_rgba(2,6,23,0.18)] backdrop-blur">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-200/10 text-cyan-200">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Privacy controls</p>
                    <p className="text-xs text-muted-foreground">Data rights and safeguards</p>
                  </div>
                </div>
                <div className="mt-5 space-y-2 text-sm">
                  <Link href="/terms" className="block rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-muted-foreground transition hover:border-cyan-200/40 hover:text-foreground">
                    Terms of Service
                  </Link>
                  <a href="mailto:start@useclevr.com" className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-muted-foreground transition hover:border-cyan-200/40 hover:text-foreground">
                    <Mail className="h-4 w-4" />
                    start@useclevr.com
                  </a>
                </div>
              </Card>
            </aside>

            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-cyan-200/15 bg-card/80 p-5 backdrop-blur">
                  <Database className="h-5 w-5 text-cyan-200" />
                  <h2 className="mt-3 text-sm font-semibold">Dataset ownership</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Uploaded datasets remain your content and are processed to provide the requested UseClevr workflows.</p>
                </Card>
                <Card className="border-cyan-200/15 bg-card/80 p-5 backdrop-blur">
                  <Cookie className="h-5 w-5 text-fuchsia-200" />
                  <h2 className="mt-3 text-sm font-semibold">Session cookies</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Cookies support sign-in, preferences, security, and product reliability.</p>
                </Card>
                <Card className="border-cyan-200/15 bg-card/80 p-5 backdrop-blur">
                  <LockKeyhole className="h-5 w-5 text-cyan-200" />
                  <h2 className="mt-3 text-sm font-semibold">Security safeguards</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Role-based access, secret handling, encryption in transit, and audit logs reduce risk.</p>
                </Card>
              </div>

              <Card className="border-l-4 border-l-cyan-300 border-cyan-200/15 bg-card/80 p-6 shadow-[0_20px_80px_rgba(2,6,23,0.16)] backdrop-blur">
                <p className="text-sm leading-7 text-muted-foreground">
                  This Privacy Policy is intended as a general SaaS legal framework and should be reviewed by a qualified legal professional before large-scale commercial launch. It is globally oriented and covers common privacy concepts, but legal obligations vary by country, state, industry, customer type, and data category.
                </p>
              </Card>

              {privacySections.map((section, index) => (
                <Card key={section.title} className="border-border/60 bg-card/80 p-6 shadow-sm backdrop-blur transition hover:border-cyan-200/25">
                  <div className="flex gap-4">
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-200/30 bg-cyan-200/10 text-sm font-semibold text-cyan-100">
                      {index + 1}
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
                      <p className="mt-3 text-sm leading-7 text-muted-foreground md:text-base">{section.body}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>
      <div className="border-t border-border/40 py-4 text-center text-sm text-muted-foreground">© UseClevr</div>
      <PublicFooter />
    </div>
  )
}
