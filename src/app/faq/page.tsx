import { PublicFooter } from "@/components/layout/public-footer"
import { PublicHeader } from "@/components/layout/public-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { ChevronDown, HelpCircle } from "lucide-react"
import * as React from "react"

const allFaqs = [
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
        q: "What payment methods are supported?",
        a: "We support all major credit and debit cards through Stripe. Enterprise invoices are available on the Business plan.",
      },
      {
        q: "Can I upgrade or downgrade my plan at any time?",
        a: "Yes. Plan changes take effect at the start of the next billing cycle. Go to Settings → Subscription to switch plans instantly.",
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
        q: "What is the Pro Annual plan?",
        a: "The Pro Annual plan charges €400 per year (€33/month equivalent) with an automatic yearly discount of €80 compared to monthly billing.",
      },
      {
        q: "Are there volume or enterprise discounts?",
        a: "Yes. The Business / Custom plan starts at €420/month and scales with your needs. Contact sales@useclevr.com for custom pricing.",
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
        q: "Can I use the API with my own LLM?",
        a: "Yes. Pro and Business users can call the /api/query and /api/chat endpoints directly. API tokens are managed from Settings.",
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
        q: "Do you use my data to train AI models?",
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
        a: "Hybrid AI Lite (~2 GB) is the recommended option for everyday use on most devices. Hybrid AI MEGA (~5 GB) is designed for business workstations with higher capacity requirements.",
      },
      {
        q: "Can I self-host UseClevr?",
        a: "Self-hosting is available on the Business / Custom plan. Contact sales@useclevr.com to discuss private deployment options for your organisation.",
      },
    ],
  },
]

function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [openIdx, setOpenIdx] = React.useState<number | null>(null)
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isOpen = openIdx === i
        let answer: React.ReactNode = item.a
        // Bold simple values in answers for scanability
        if (typeof answer === "string") {
          answer = (
            <span dangerouslySetInnerHTML={{
              __html: answer
                .replace(/(€[\d,]+(?:\/month| per month| annually)?)/g, '<strong>$1</strong>')
                .replace(/(\d+-\d+ \w+)/g, '<strong>$1</strong>')
            }} />
          )
        }
        return (
          <div key={i} className="rounded-lg border border-border bg-background overflow-hidden">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpenIdx(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
            >
              <span className="text-sm font-medium text-foreground">{item.q}</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
              <div className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border/40 pt-4">
                {answer}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function FaqPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />
      <main className="flex-1 py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/50 bg-primary/10 text-sm text-primary mb-4">
              <HelpCircle className="h-3.5 w-3.5" />
              FAQ
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Frequently asked questions</h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Everything you need to know about UseClevr, from setup to billing and beyond.
            </p>
          </div>

          {allFaqs.map((section) => (
            <div key={section.category} className="mb-12">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {section.category}
              </h2>
              <FaqAccordion items={section.items} />
            </div>
          ))}

          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Can&apos;t find the answer you&apos;re looking for?
            </p>
            <a href="mailto:support@useclevr.com">
              <Button variant="outline" className="gap-2 bg-transparent">
                Contact support
              </Button>
            </a>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
