// Shared FAQ content — single source of truth for both the homepage
// inline accordion and the full /faq page.
// 
// To migrate to a CMS: replace this file with a fetch() call to your
// CMS REST endpoint (e.g. Contentful, Sanity, Strapi) and keep the
// `FaqCategory` type as the wire format contract.

import { billingPlans, publicMonthlyPlanPrices, publicProMonthlyLaunchPrices } from "@/lib/billing/plans"

const _freePlan = billingPlans.find(p => p.id === "free")!;
const proLaunchPriceText = publicProMonthlyLaunchPrices.map((price) => price.label).join(", ")

export interface FaqItem {
  q: string
  a: string
  tag?: string
}

export interface FaqCategory {
  category: string
  items: FaqItem[]
}

// ── Categories as they appear on the full /faq page ──────────────────────────
export const allFaqCategories: FaqCategory[] = [
  {
    category: "Getting Started",
    items: [
      {
        q: "How does UseClevr turn CSV data into answers?",
        a: "Upload a CSV file and ask questions in plain English. UseClevr's AI reads your table headers and data types, runs verified calculations (sum, average, top-N, group-by, etc.), and returns both the computed result and a plain-language explanation.",
      },
      {
        q: "Do I need SQL or data science skills?",
        a: "No. UseClevr translates natural language into structured queries and deterministic calculations. You only need to understand your own data — the platform handles the rest.",
      },
      {
        q: "How do I upload a dataset?",
        a: 'Go to the Datasets page from the sidebar and click "Upload dataset". Supported format is CSV (up to 50 MB per file). Once uploaded, the column headers are parsed and the dataset is ready for analysis.',
      },
      {
        q: "What file formats are supported?",
        a: "CSV files are fully supported for upload, analysis, and report generation. We recommend UTF-8 encoded CSVs with a header row.",
      },
      {
        q: "How long does setup take?",
        a: "Most users are analysing their first dataset within five minutes. Create an account, upload a CSV, and type your first question — no configuration required.",
      },
    ],
  },
  {
    category: "Plans & Billing",
    items: [
      {
        q: "How do payments and subscriptions work?",
        a: "UseClevr uses Stripe Checkout for secure subscription payments. When you choose a paid plan, you are redirected to Stripe's secure checkout page to enter your payment details. After payment, you are redirected back to UseClevr and your subscription is activated automatically.",
      },
      {
        q: "What payment methods are supported?",
        a: "We support all major credit and debit cards through Stripe. Enterprise invoices are available on the Business plan.",
      },
      {
        q: "Does UseClevr store my card details?",
        a: "No. UseClevr does not store your card details. Payments are processed securely by Stripe.",
      },
      {
        q: "Can I upgrade or downgrade my plan at any time?",
        a: "Yes. Plan changes take effect at the start of the next billing cycle. Go to Settings → Subscription to switch plans instantly.",
      },
      {
        q: "What happens after I upgrade?",
        a: "After upgrading, your account is updated automatically and you get access to the features included in your selected plan, such as more datasets, more AI credits, business analysis, reports, exports, and support.",
      },
      {
        q: "Can I cancel my subscription?",
        a: "Yes. You can cancel your subscription from your billing settings. Your paid access remains active until the end of your current billing period.",
      },
      {
        q: "What happens to my data when I downgrade or cancel?",
        a: "Your data remains accessible until the end of the current billing period. After cancellation, you can re-subscribe at any time to restore full access.",
      },
      {
        q: "Is there a free plan?",
        a: `Yes. The Free plan includes ${_freePlan.limits.maxDatasets} datasets and limited AI questions so you can try the platform before upgrading. No credit card required.`,
      },
      {
        q: "Can I receive an invoice?",
        a: "Yes. Invoices and payment receipts are handled through Stripe and can be accessed from your billing area.",
      },
      {
        q: "How do I get a refund?",
        a: "Contact support to request a refund. Processing time depends on the payment provider and card issuer.",
      },
      {
        q: "What if my card is expired or declined?",
        a: "The payment provider retries the payment and usually emails you to update payment details.",
      },
      {
        q: "I paid but do not have access. What do I do?",
        a: "Open a support ticket with your transaction ID or receipt so support can restore access.",
      },
      {
        q: "I see an unexpected charge. What now?",
        a: "Check your account and subscription details first, then contact support. Contact your card issuer if the charge looks unauthorized.",
      },
       {
         q: "What does Pro cost?",
         a: `Pro launch pricing is ${proLaunchPriceText}. Business is €${publicMonthlyPlanPrices.business}/month.`,
       },
       {
         q: "Can I get a custom business plan?",
         a: `Business is €${publicMonthlyPlanPrices.business}/month and is designed for teams that need accounting AI, document processing, and dedicated support. Contact sales@useclevr.com for billing or support questions.`,
       },
      {
        q: "Will I be charged on my billing day?",
        a: "Yes. Subscriptions renew automatically on the scheduled billing date.",
      },
      {
        q: "Do I need to log in or visit the site for renewal?",
        a: "No. Renewals happen automatically through the payment provider.",
      },
    ],
  },
  {
    category: "AI & Analysis",
    items: [
      {
        q: "How does UseClevr answer AI questions?",
        a: "UseClevr provides cloud analysis for standard workflows and UseClevr Hybrid AI for private analysis on your device. Files stay on your device when Hybrid AI is active.",
      },
      {
        q: "What kinds of questions can I ask?",
        a: "Any question your structured data can answer: totals, averages, top-N rankings, group-by summaries, comparisons over time, trend analysis, and more. The AI will confirm if a question cannot be answered with the available columns.",
      },
      {
        q: "How do I get the best answer from the AI assistant?",
        a: "Ask one clear question, name the dataset or metric when it matters, and ask for the direct result first. Add context such as period, region, product, or customer segment when you need a focused answer.",
      },
      {
        q: "Is Hybrid AI really local?",
        a: "Yes. Hybrid AI connects to UseClevr Helper on your device. UseClevr Helper processes private analysis locally.",
      },
      {
        q: "Which Hybrid AI mode should I pick?",
        a: "Lite is recommended for everyday use on most devices. Standard adds cost-benefit analysis. Mega is designed for business workstations and must be requested via support.",
      },
    ],
  },
  {
    category: "Data & Privacy",
    items: [
      {
        q: "Is my data secure?",
        a: "UseClevr is built with GDPR-oriented privacy controls and SOC 2-aligned security practices. Uploaded datasets and generated reports remain your content, and UseClevr does not use them to train external systems.",
      },
      {
        q: "Where is my data stored?",
        a: "Your datasets are stored in your configured database (Neon PostgreSQL). Reports are generated on demand and served to your browser. No persistent cloud AI storage is used.",
      },
      {
        q: "Can I delete my data?",
        a: "Yes. You can delete individual datasets from the Datasets page, or request full account deletion by contacting support. All data is removed within 30 days.",
      },
      {
        q: "Do you use my data for training?",
        a: "No. UseClevr never uses your uploaded data, questions, or generated reports to train external systems.",
      },
    ],
  },
  {
    category: "Technical",
    items: [
      {
        q: "Which browsers are supported?",
        a: "UseClevr works on all modern browsers: Chrome, Firefox, Safari, and Edge (latest two stable versions). Hybrid AI Lite requires UseClevr Helper.",
      },
      {
        q: "Is there an API?",
        a: "Yes. UseClevr provides REST API endpoints for queries and chat completions. See the Developer Guide for authentication, rate limits, and example requests.",
      },
      {
        q: "What is Hybrid AI Lite vs Mega?",
        a: "Hybrid AI Lite is the recommended option for everyday use on most devices. Hybrid AI MEGA is designed for business workstations with higher capacity requirements.",
      },
      {
        q: "Can I self-host UseClevr?",
        a: "Self-hosting is not part of the standard public plans. Contact sales@useclevr.com if you need to discuss a future private setup.",
      },
      {
        q: "Can I change theme, contrast, or text size?",
        a: "Yes. Use the display settings icon to choose Light, Dark, or System theme. High contrast increases visual separation, and Larger text raises the reading size across pages.",
      },
    ],
  },
]

// ── Flat list for the homepage accordion (first N + link to full page) ─────────
export function getHomepageFaqs(limit = 5): FaqItem[] {
  const all = allFaqCategories.flatMap((c) => c.items)
  return all.slice(0, limit)
}

export function getPricingFaqs(limit = 5): FaqItem[] {
  const pricingCategories = new Set(["Plans & Billing", "AI & Analysis", "Technical"])
  return allFaqCategories
    .filter((category) => pricingCategories.has(category.category))
    .flatMap((category) =>
      category.items.map((item) => ({
        ...item,
        tag: category.category,
      })),
    )
    .slice(0, limit)
}
