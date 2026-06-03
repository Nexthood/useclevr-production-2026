// Shared FAQ content — single source of truth for both the homepage
// inline accordion and the full /faq page.
// 
// To migrate to a CMS: replace this file with a fetch() call to your
// CMS REST endpoint (e.g. Contentful, Sanity, Strapi) and keep the
// `FaqCategory` type as the wire format contract.

import { billingPlans } from "@/lib/billing/plans"

const _freePlan = billingPlans.find(p => p.id === "free")!;
const _proMonthlyPlan = billingPlans.find(p => p.id === "pro_monthly")!;
const _proAnnualPlan = billingPlans.find(p => p.id === "pro_annual")!;
const _businessPlan = billingPlans.find(p => p.id === "business_monthly")!;

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
        a: "After upgrading, your account is updated automatically and you get access to the features included in your selected plan, such as higher usage limits, advanced reports, downloads, and premium analysis features.",
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
        a: "Yes — the Free plan includes 1 dataset and limited AI questions so you can try the platform before upgrading. No credit card required.",
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
         q: "What is the Pro Annual plan?",
         a: `The Pro Annual plan charges €${_proAnnualPlan.price} per year (€${(_proAnnualPlan.price / 12).toFixed(0)}/month equivalent) with an automatic yearly discount of €${((_proMonthlyPlan.price * 12) - _proAnnualPlan.price).toFixed(0)} compared to monthly billing.`,
       },
       {
         q: "Can I get a custom business plan?",
         a: `Yes. The Business / Custom plan starts at €${_businessPlan.price}/month and scales with your needs. Contact sales@useclevr.com for custom pricing, private SLAs, or on-premise deployment.`,
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
        q: "Which AI models does UseClevr use?",
        a: "UseClevr uses Google Gemini via the AI SDK for cloud analysis. Hybrid AI Lite runs a local model in your browser for sensitive datasets — your data never leaves your device during local analysis.",
      },
      {
        q: "What kinds of questions can I ask?",
        a: "Any question your structured data can answer: totals, averages, top-N rankings, group-by summaries, comparisons over time, trend analysis, and more. The AI will confirm if a question cannot be answered with the available columns.",
      },
      {
        q: "Is Hybrid AI really local?",
        a: "Yes. Hybrid AI Lite downloads a small local engine to your browser. All calculations run on your machine. No data is sent to the cloud during local analysis.",
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
        a: "UseClevr is GDPR-compliant and aligned with SOC 2 principles. Uploaded datasets and generated reports are your property. We never train external models on your data.",
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
        q: "Do you use my data to train models?",
        a: "No. UseClevr never uses your uploaded data, questions, or generated reports to train or fine-tune any external model.",
      },
    ],
  },
  {
    category: "Technical",
    items: [
      {
        q: "Which browsers are supported?",
        a: "UseClevr works on all modern browsers: Chrome, Firefox, Safari, and Edge (latest two stable versions). Hybrid AI Lite requires a browser with WebAssembly support.",
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
        a: "Self-hosting is available on the Business / Custom plan. Contact sales@useclevr.com to discuss private deployment options for your organisation.",
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
