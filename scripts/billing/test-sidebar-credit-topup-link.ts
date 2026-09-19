import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  CREDIT_TOP_UPS_BILLING_HREF,
  CREDIT_TOP_UPS_SECTION_ID,
} from "../../src/lib/billing/credit-topup-navigation"

const root = resolve(import.meta.dirname, "../..")

function readProjectFile(path: string) {
  return readFileSync(resolve(root, path), "utf8")
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const usageMonitor = readProjectFile("src/components/ui/usage-monitor.tsx")
const appSidebar = readProjectFile("src/components/layout/app-sidebar.tsx")
const subscriptionPage = readProjectFile("src/app/(auth)/app/settings/subscription/page.tsx")
const topupStatusRoute = readProjectFile("src/app/api/billing/credit-topup/status/route.ts")
const topupHistoryRoute = readProjectFile("src/app/api/billing/topup-history/route.ts")

assert(
  CREDIT_TOP_UPS_BILLING_HREF === "/app/settings/subscription?tab=billing#credit-topups",
  "Credit top-up sidebar link must open the billing tab and credit top-up anchor.",
)

assert(
  usageMonitor.includes("CREDIT_TOP_UPS_BILLING_HREF"),
  "UsageMonitor must use the shared credit top-up billing href.",
)

assert(
  usageMonitor.includes("+ Add Credits"),
  "UsageMonitor must render the compact + Add Credits action.",
)

// The Pro/Business sidebar card renders the isPaidPro branch of UsageMonitor.
// A regression once shipped the link in every other branch but missed this
// one, so the paying customer's sidebar card showed no Add Credits button.
// Every card variant must render the link.
const addCreditsLinkCount = usageMonitor.split("<AddCreditsLink onClick={onAddCreditsClick} />").length - 1
assert(
  addCreditsLinkCount === 4,
  `UsageMonitor must render the + Add Credits link in all four card variants (unlimited, paid Pro/Business, no credits, standard) — found ${addCreditsLinkCount}.`,
)

const paidProBlock = usageMonitor.slice(
  usageMonitor.indexOf("isPaidPro) {"),
  usageMonitor.indexOf("if (availableCredits <= 0)"),
)
assert(
  paidProBlock.includes("<AddCreditsLink"),
  "The paid Pro/Business sidebar card must render the + Add Credits link directly below the credit/progress information.",
)

assert(
  usageMonitor.includes('href={CREDIT_TOP_UPS_BILLING_HREF}'),
  "The + Add Credits link must point at the shared billing href.",
)

assert(
  !usageMonitor.includes("/api/checkout/credit-topup"),
  "UsageMonitor must not start checkout directly from the sidebar card.",
)

assert(
  appSidebar.includes("onAddCreditsClick={() => setIsMobileOpen(false)}"),
  "AppSidebar must close the mobile sidebar after the Add Credits link is clicked.",
)

assert(
  CREDIT_TOP_UPS_SECTION_ID === "credit-topups" &&
    subscriptionPage.includes("id={CREDIT_TOP_UPS_SECTION_ID}"),
  "Subscription billing page must expose the stable credit top-up section anchor.",
)

assert(
  subscriptionPage.includes('className="scroll-mt-24'),
  "The credit top-up anchor must offset the sticky header when scrolled to.",
)

// PaymentIntent references stay internal: the customer-facing Billing /
// Credit Top-Up History UI and the customer-facing top-up APIs must not
// expose the Stripe PaymentIntent (pi_...) reference. The database keeps the
// full reference for refunds, reconciliation, webhooks, and support.
assert(
  !subscriptionPage.includes("Payment reference:"),
  "The Billing page must not render a Payment reference line to customers.",
)

assert(
  !/providerPaymentId\}/.test(subscriptionPage.replace(/\{\/\*[\s\S]*?\*\/\}/g, "")),
  "The Billing page must not render the Stripe PaymentIntent ID.",
)

assert(
  !topupStatusRoute.includes("providerPaymentId") && !topupStatusRoute.includes("reference:"),
  "The top-up status API must not expose the Stripe PaymentIntent ID.",
)

assert(
  !topupHistoryRoute.includes("providerPaymentId") &&
    !topupHistoryRoute.includes("providerCheckoutId") &&
    !topupHistoryRoute.includes("ledgerEntryId") &&
    !topupHistoryRoute.includes("metadata:"),
  "The top-up history API must not expose internal payment references.",
)

assert(
  readProjectFile("src/lib/billing/credit-topup-service.ts").includes("providerPaymentId: string"),
  "The backend keeps the internal payment reference for refunds, reconciliation, webhooks, idempotency, and support.",
)

console.warn("Sidebar credit top-up link checks passed.")
