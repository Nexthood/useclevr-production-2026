import { Building2 } from "lucide-react";
import { DashboardSubpageLayout } from "@/components/layout/dashboard-subpage-layout"
import { RetailInventoryClient } from "@/components/retail/retail-inventory-client"
import { RetailIntegrationsClient } from "@/components/retail/retail-integrations-client"

export default function RetailPage() {
  return (
    <DashboardSubpageLayout
      title="Retail Inventory Analyst"
      description="Upload sales and inventory data to find profit opportunities, low-stock risks, and dead stock."
      breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Retail" }]}
      icon={Building2}
    >
      <div className="min-w-0 flex-1 px-4 pb-6 pt-6 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <RetailIntegrationsClient />
          <RetailInventoryClient embedded />
        </div>
      </div>
    </DashboardSubpageLayout>
  );
}
