import type { FaqCategory } from "@/lib/content/faq"

export const customerBillingFaqs: FaqCategory = {
  category: "Billing",
  items: [
    {
      q: "Will I be charged on my billing day?",
      a: "Yes. Subscriptions renew automatically on the scheduled billing date.",
    },
    {
      q: "Do I need to log in or visit the site for renewal?",
      a: "No. Renewals happen automatically through the payment provider.",
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
      q: "Can I change or cancel my subscription?",
      a: "Yes. Go to Settings → Subscription, or contact support. Timing depends on the payment provider settings.",
    },
    {
      q: "Will I receive invoices or receipts?",
      a: "Yes. Receipts and invoices are emailed and may also be available from your account or payment portal.",
    },
    {
      q: "How do I get a refund?",
      a: "Open a ticket or contact support. Refund timing depends on the payment provider and card issuer.",
    },
    {
      q: "I see an unexpected charge. What now?",
      a: "Check your account and subscription details first, then open a support ticket. Contact your card issuer if the charge looks unauthorized.",
    },
    {
      q: "Are my payment details secure?",
      a: "Payment details are handled by secure payment providers. UseClevr does not store full card numbers.",
    },
  ],
}

export const dashboardFaqCategories: FaqCategory[] = [
  {
    category: "Dashboard",
    items: [
      {
        q: "Where do I start?",
        a: "Open Datasets, upload a CSV file, then use the dataset analysis page to review metrics, ask questions, and generate reports.",
      },
      {
        q: "Where are my reports?",
        a: "Generated reports are listed in Reports & Downloads. You can download ready reports or retry failed exports from that page.",
      },
      {
        q: "How do credits work?",
        a: "Free users have limited AI analyst credits. Pro, Business, and super-admin accounts have higher or unlimited access depending on the configured plan rules.",
      },
      {
        q: "How do I update business details?",
        a: "Go to Business → Profile to update your business name, industry, location, website, and description.",
      },
      {
        q: "How do I contact support?",
        a: "Open Tickets & Issues from the topbar or sidebar, create a ticket, and track the response from the same page.",
      },
      {
        q: "How do I change theme, contrast, or text size?",
        a: "Open the display settings icon in the topbar. Choose Light, Dark, or System theme, then turn on High contrast or Larger text when you need stronger contrast or a higher reading size.",
      },
      {
        q: "How do I get faster, clearer AI answers?",
        a: "Select the right dataset, ask one direct question, name the metric or period you care about, and use thumbs-up or thumbs-down so answer quality can be reviewed.",
      },
    ],
  },
  customerBillingFaqs,
  {
    category: "Hybrid AI",
    items: [
      {
        q: "Who can download Hybrid AI?",
        a: "Pro users can use Hybrid AI Lite. Business users can use Hybrid AI MEGA. Super-admins can see both options for testing.",
      },
      {
        q: "Why do I see plan options instead of a download?",
        a: "Your current plan may not include local Hybrid AI. Upgrade from Settings → Subscription or the public Plans page.",
      },
      {
        q: "Does local mode replace cloud analysis?",
        a: "No. Local mode is an extra option for private or offline workflows. Cloud analysis remains available when your plan allows it.",
      },
      {
        q: "How can I test Hybrid AI without installing UseClevr Helper?",
        a: "Developers can enable the local test mode in development. The app then uses branded helper status and private-analysis responses for UI testing.",
      },
    ],
  },
]

export const superAdminFaqCategories: FaqCategory[] = [
  {
    category: "Super-admin tools",
    items: [
      {
        q: "What can a super-admin do?",
        a: "A super-admin can review support tickets, update billing settings, inspect payment configuration, adjust credit rules, test subscription flows, and access both Hybrid AI Lite and MEGA options.",
      },
      {
        q: "Where are billing settings?",
        a: "Use Settings → Billing for plan configuration and Settings → Payment for Stripe environment status.",
      },
      {
        q: "Where are credit rules?",
        a: "Use Settings → Credit Rules to review AI credits and Hybrid AI download credit requirements.",
      },
      {
        q: "How are support tickets resolved?",
        a: "Open Tickets & Issues, add a support note, and mark the ticket open, in progress, or resolved.",
      },
      {
        q: "How should operators review AI answer quality?",
        a: "Use AI trace history, user feedback, repeated questions, and error patterns to find unclear answers and turn them into FAQ updates, prompt improvements, or support tasks.",
      },
    ],
  },
  {
    category: "Payments and subscriptions",
    items: [
      {
        q: "Who charges customers?",
        a: "The payment provider, such as Stripe, handles scheduled billing independently.",
      },
      {
        q: "When are charges attempted?",
        a: "Charges run on the subscription billing date configured in the payment provider.",
      },
      {
        q: "What if a charge fails?",
        a: "The provider applies configured retry and dunning rules. Inspect the provider dashboard for failures.",
      },
      {
        q: "How should access update after payment?",
        a: "Process provider webhooks such as invoice.paid, invoice.payment_failed, and customer.subscription.updated to grant or revoke access.",
      },
      {
        q: "What if webhook events are missed?",
        a: "Retrieve and replay past events through the provider API, then reconcile subscriptions and internal access records.",
      },
      {
        q: "How are plan changes and proration handled?",
        a: "Configure proration in the payment provider or implement custom proration through the provider API.",
      },
      {
        q: "How are invoices, taxes, and receipts handled?",
        a: "Use provider invoicing and tax features, or integrate a tax service where required.",
      },
      {
        q: "How do we reconcile payments with internal records?",
        a: "Use webhooks for real-time updates, poll event history when needed, and run periodic reconciliation reports.",
      },
      {
        q: "What security measures are required?",
        a: "Protect and rotate API keys, validate webhook signatures, follow least privilege, and audit access.",
      },
      {
        q: "What should we do during incidents?",
        a: "Check provider payment status, fetch or replay missed events, reconcile access manually if needed, rotate exposed credentials, and notify customers where appropriate.",
      },
    ],
  },
  {
    category: "Key pages",
    items: [
      {
        q: "Which pages should operators know?",
        a: "Dashboard, Datasets, Reports & Downloads, Tickets & Issues, Dashboard FAQ, Settings → Subscription, Billing, Payment, Credit Rules, and Business.",
      },
      {
        q: "Which public pages matter for support?",
        a: "Home, Plans, FAQ, Contact, Security, Privacy, and Terms are the main public pages customers may reference.",
      },
      {
        q: "Which API areas matter for operations?",
        a: "Checkout, webhooks, usage, tickets, upload, reports, health, billing settings, and UseClevr Helper status are the main operational API areas.",
      },
    ],
  },
]
