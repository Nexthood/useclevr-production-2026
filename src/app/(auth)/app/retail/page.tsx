import { Building2, FileText, Upload } from "lucide-react";
import DashboardSubpageLayout from "@/components/layout/dashboard-subpage-layout";

export default function RetailPage() {
  return (
    <DashboardSubpageLayout
      title="Retail Inventory Analyst"
      description="Upload sales and inventory data to find profit opportunities, low-stock risks, and dead stock."
      icon={Building2}
    >
      <div className="min-w-0 flex-1 px-4 pt-10 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground">Upload CSV/Excel</h3>
                <p className="text-xs text-muted-foreground">Sales and inventory files accepted</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-lg font-semibold text-foreground">AI Insights Summary</h3>
            <p className="mt-1 text-sm text-muted-foreground">Provisional analysis of key metrics</p>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-lg font-semibold text-foreground">Low Stock Alerts</h3>
            <p className="mt-1 text-sm text-muted-foreground">Items below defined stock thresholds</p>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-lg font-semibold text-foreground">Dead Stock & Slow Movers</h3>
            <p className="mt-1 text-sm text-muted-foreground">Products with declining velocity</p>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-lg font-semibold text-foreground">Top Profit Products</h3>
            <p className="mt-1 text-sm text-muted-foreground">Products ranked by margin performance</p>
          </div>
        </div>
      </div>
    </DashboardSubpageLayout>
  );
}

