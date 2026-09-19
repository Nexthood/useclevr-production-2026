import { existsSync, readFileSync } from "node:fs"
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
// The report-only status API ships with the post-checkout poller; branches
// without that endpoint simply skip its assertions below.
const statusRoutePath = "src/app/api/billing/credit-topup/status/route.ts"
const statusRouteExists = existsSync(resolve(root, statusRoutePath))
const topupStatusRoute = statusRouteExists ? readProjectFile(statusRoutePath) : ""
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
  "UsageMonitor must render the compact + Add Credits action for paid plans.",
)

// The Pro/Business sidebar card renders the isPaidPlan branch of UsageMonitor.
// A regression once shipped the link in every other branch but missed this
// one, so the paying customer's sidebar card showed no Add Credits button.
// The paid Pro/Business card variant must render the link exactly once.
const addCreditsLinkCount = usageMonitor.split("<AddCreditsLink onClick={onAddCreditsClick} />").length - 1
assert(
  addCreditsLinkCount === 1,
  `UsageMonitor must render the + Add Credits link only on the paid Pro/Business card — found ${addCreditsLinkCount}.`,
)

const paidProBlock = usageMonitor.slice(
  usageMonitor.indexOf("isPaidPlan) {"),
  usageMonitor.indexOf("if (availableCredits <= 0)"),
)
assert(
  paidProBlock.includes("<AddCreditsLink"),
  "The paid Pro/Business sidebar card must render the + Add Credits link directly below the credit/progress information.",
)

// Free accounts must never see the + Add Credits purchase action: the two
// Free card variants render an Upgrade link instead, and preserved purchased
// credits are displayed as usable existing credits.
const freeBlocks = usageMonitor.slice(usageMonitor.indexOf("if (availableCredits <= 0)"))
assert(
  !freeBlocks.includes("<AddCreditsLink"),
  "Free sidebar card variants must not render the + Add Credits purchase action.",
)
assert(
  freeBlocks.includes("<UpgradeLink"),
  "Free sidebar card variants must offer an Upgrade to Pro path.",
)
assert(
  freeBlocks.includes("remain usable on the Free plan") || freeBlocks.includes("usable on the Free plan"),
  "The Free sidebar card must describe preserved purchased credits as usable existing credits.",
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

// The report-only status API exists on branches that ship the post-checkout
// poller. When present, it must never expose the Stripe PaymentIntent ID.
if (statusRouteExists) {
  assert(
    !topupStatusRoute.includes("providerPaymentId") && !topupStatusRoute.includes("reference:"),
    "The top-up status API must not expose the Stripe PaymentIntent ID.",
  )
}

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
