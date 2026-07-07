import { Building2 } from "lucide-react";
import { DashboardSubpageLayout } from "@/components/layout/dashboard-subpage-layout"
import { RetailInventoryClient } from "@/components/retail/retail-inventory-client"

export default function RetailPage() {
  return (
    <DashboardSubpageLayout
      title="Retail Inventory Analyst"
      description="Upload sales and inventory data to find profit opportunities, low-stock risks, and dead stock."
      breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Retail" }]}
      icon={Building2}
    >
      <RetailInventoryClient />
    </DashboardSubpageLayout>
  );
}
