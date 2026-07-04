import { PublicFooter } from "@/components/layout/public-footer"
import { PublicHeader } from "@/components/layout/public-header"
import { Card } from "@/components/ui/card"
import { FileText, Mail, ShieldCheck } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

const LAST_UPDATED = "July 4, 2026"

const termsSections = [
  {
    title: "Acceptance of Terms",
    body: "By creating an account, accessing UseClevr, uploading data, purchasing a subscription, or using any UseClevr feature from any country, you agree to these Terms of Service and any plan-specific terms shown during checkout. If you use UseClevr for an organization, you confirm that you are authorized to accept these terms on its behalf.",
  },
  {
    title: "Use of Service",
    body: "UseClevr provides AI-assisted business intelligence, dataset analysis, reporting, forecasting support, dashboard insights, and related SaaS workflow tools for global business users. You may use the service only for lawful business purposes and in accordance with these terms, applicable local laws, export-control rules, sanctions rules, and data-protection requirements.",
  },
  {
    title: "User Accounts",
    body: "You are responsible for maintaining accurate account information, protecting login credentials, verifying your email address when required, and all activity that occurs under your account. Notify UseClevr promptly if you believe your account has been accessed without permission.",
  },
  {
    title: "AI-Generated Content Disclaimer",
    body: "UseClevr may generate summaries, recommendations, forecasts, explanations, and business insights using AI systems, configured AI providers, local or cloud processing, and deterministic calculations. AI-generated content can be incomplete, outdated, or inaccurate and does not replace professional legal, tax, accounting, financial, medical, investment, employment, compliance, or operational advice in any jurisdiction. You are responsible for reviewing outputs before relying on them.",
  },
  {
    title: "Global SaaS Subscription & Billing",
    body: "Paid subscriptions are billed through the checkout and billing provider shown in the product, including Stripe where available. Fees, billing intervals, included usage, available features, local taxes, currency handling, and renewal terms are displayed before purchase. You authorize the payment provider to charge applicable subscription fees, taxes, currency conversion amounts, and renewal amounts until cancellation.",
  },
  {
    title: "Free and Paid Plans",
    body: "Free plans include limited datasets and limited AI usage for evaluation. Paid plans unlock additional capacity and features according to the active plan and the country where the service is offered. UseClevr may update plan names, included usage, pricing, taxes, currencies, or features, but material changes are communicated through the product, checkout, account areas, or other reasonable notice.",
  },
  {
    title: "Refund Policy",
    body: "Unless required by applicable law or mandatory consumer rights in your jurisdiction, subscription fees are generally non-refundable once a billing period starts. If you believe a charge was made in error, local consumer law gives you a specific cancellation right, or the service was not delivered as expected, contact UseClevr support so the request can be reviewed case by case.",
  },
  {
    title: "User Responsibilities",
    body: "You must ensure that uploaded datasets, prompts, account details, and business content are accurate, lawful, and appropriate for processing. You are responsible for obtaining required permissions before uploading personal data, customer data, employee data, confidential business information, or third-party content.",
  },
  {
    title: "Intellectual Property",
    body: "UseClevr, its software, interface, brand, documentation, workflows, templates, analytics methods, and platform content remain owned by UseClevr or its licensors worldwide. You retain ownership of uploaded datasets and your business content. UseClevr receives the limited rights needed to process, secure, display, transmit, host, back up, and support that content within the service and with service providers acting on UseClevr's behalf.",
  },
  {
    title: "Acceptable Use",
    body: "You may not use UseClevr to break the law, infringe rights, upload malicious code, attempt unauthorized access, overload the service, scrape the platform, reverse engineer restricted systems, bypass plan limits, violate sanctions or export-control rules, misrepresent AI outputs as guaranteed facts, or process sensitive data without a lawful basis and required permissions.",
  },
  {
    title: "Limitation of Liability",
    body: "To the maximum extent permitted by applicable law, UseClevr is not liable for indirect, incidental, consequential, special, punitive, exemplary, business-interruption, data-loss, or lost-profit damages. UseClevr's aggregate liability for claims related to the service is limited to the amounts paid for the affected service during the twelve months before the claim, unless a different limit is required by mandatory law.",
  },
  {
    title: "Service Availability",
    body: "UseClevr works to keep the service available, secure, and reliable, but availability is not guaranteed. Maintenance, third-party providers, network issues, AI provider outages, payment provider outages, or force majeure events may affect access or performance.",
  },
  {
    title: "Account Termination",
    body: "You may stop using UseClevr or cancel paid access through the available account or billing tools. UseClevr may suspend or terminate access if an account violates these terms, creates security risk, causes payment failure, or is used unlawfully. Data export or deletion requests are handled under the Privacy Policy and applicable law.",
  },
  {
    title: "Governing Law",
    body: "These terms are governed by the laws applicable to the UseClevr operating entity, without limiting mandatory consumer, privacy, payment, or data-protection rights that apply in your jurisdiction. International users remain responsible for complying with local laws that apply to their organization, industry, data, and use of the service. Disputes should first be raised with UseClevr so the parties can attempt to resolve them informally.",
  },
  {
    title: "International Users",
    body: "UseClevr is intended for a worldwide market. Access to the service may vary by country because of payment availability, local law, sanctions, export controls, tax requirements, infrastructure, or third-party provider availability. By using the service from outside the UseClevr operating country, you understand that service delivery, support, billing, and data processing may involve systems and providers in other countries.",
  },
  {
    title: "Contact Information",
    body: "Questions about these terms, billing, account access, or service use can be sent to start@useclevr.com.",
  },
]

export const metadata: Metadata = {
  title: "Terms of Service | UseClevr",
  description: "Read the global UseClevr Terms of Service for SaaS accounts, AI-generated content, subscriptions, Stripe billing, acceptable use, liability, international users, and contact information.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service | UseClevr",
    description: "UseClevr global SaaS terms for accounts, subscriptions, AI-assisted business intelligence, acceptable use, international users, and billing.",
    url: "/terms",
    siteName: "UseClevr",
    type: "website",
  },
}

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PublicHeader />
      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-cyan-200/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.98))]">
          <div className="container mx-auto px-4 py-16 md:px-6 md:py-20">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-200/30 bg-cyan-200/10 px-4 py-2 text-sm font-medium text-cyan-100">
                <FileText className="h-4 w-4" />
                Legal
              </div>
              <h1 className="text-4xl font-bold tracking-tight md:text-6xl">Terms of Service</h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                The worldwide SaaS terms for using UseClevr, including accounts, AI-assisted outputs, subscriptions, billing, acceptable use, and service availability.
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
                    <p className="text-sm font-semibold">Legal documents</p>
                    <p className="text-xs text-muted-foreground">UseClevr SaaS terms</p>
                  </div>
                </div>
                <div className="mt-5 space-y-2 text-sm">
                  <Link href="/privacy" className="block rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-muted-foreground transition hover:border-cyan-200/40 hover:text-foreground">
                    Privacy Policy
                  </Link>
                  <a href="mailto:start@useclevr.com" className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-muted-foreground transition hover:border-cyan-200/40 hover:text-foreground">
                    <Mail className="h-4 w-4" />
                    start@useclevr.com
                  </a>
                </div>
              </Card>
            </aside>

            <div className="space-y-5">
              <Card className="border-l-4 border-l-cyan-300 border-cyan-200/15 bg-card/80 p-6 shadow-[0_20px_80px_rgba(2,6,23,0.16)] backdrop-blur">
                <p className="text-sm leading-7 text-muted-foreground">
                  These terms are intended as a general SaaS legal framework and should be reviewed by a qualified legal professional before large-scale commercial launch. They are written for product clarity and operational transparency, not as a substitute for legal advice in any specific country.
                </p>
              </Card>

              {termsSections.map((section, index) => (
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
