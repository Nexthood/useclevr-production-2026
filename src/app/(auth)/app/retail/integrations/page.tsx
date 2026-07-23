import { PlugZap } from "lucide-react";

import { DashboardSubpageLayout } from "@/components/layout/dashboard-subpage-layout";
import { RetailIntegrationsClient } from "@/components/retail/retail-integrations-client";

export default function RetailIntegrationsPage() {
  return (
    <DashboardSubpageLayout
      title="Retail Integrations"
      description="Connect retail systems and review POS synchronization status."
      breadcrumbs={[
        { label: "Dashboard", href: "/app" },
        { label: "Retail", href: "/app/retail" },
        { label: "Integrations" },
      ]}
      icon={PlugZap}
    >
      <RetailIntegrationsClient />
    </DashboardSubpageLayout>
  );
}
