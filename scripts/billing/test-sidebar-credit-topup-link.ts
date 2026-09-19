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

console.warn("Sidebar credit top-up link checks passed.")
