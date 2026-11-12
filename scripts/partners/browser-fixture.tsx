import { createRoot } from "react-dom/client";
import { PartnerDashboard } from "../../src/components/partners/partner-dashboard";
import { PartnerApplication } from "../../src/components/partners/partner-application";
import { PartnerOnboarding } from "../../src/components/partners/partner-onboarding";
import { PartnerAdmin } from "../../src/components/partners/partner-admin";

const query = new URLSearchParams(location.search);
document.documentElement.classList.toggle("dark", query.get("theme") === "dark");
createRoot(document.getElementById("root")!).render(
  <main className="mx-auto max-w-6xl space-y-5 p-4 text-foreground">
    <h1 className="text-2xl font-semibold">Synthetic partner acceptance</h1>
    {query.has("onboard") ? (
      <PartnerOnboarding token={"synthetic-browser-invitation-32-bytes-only"} />
    ) : query.has("apply") ? (
      <PartnerApplication partnershipType={query.get("partnershipType") || undefined} />
    ) : query.has("admin") ? (
      <PartnerAdmin />
    ) : (
      <PartnerDashboard />
    )}
  </main>,
);
