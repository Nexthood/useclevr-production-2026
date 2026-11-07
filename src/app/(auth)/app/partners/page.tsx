import {
  DashboardContent,
  DashboardSubpageLayout,
} from "@/components/layout/dashboard-subpage-layout";
import { PartnerDashboard } from "@/components/partners/partner-dashboard";
export default function PartnersPage() {
  return (
    <DashboardSubpageLayout
      title="Global Partner Program"
      description="Your customers, partner level, commissions, and settlements."
    >
      <DashboardContent>
        <PartnerDashboard />
      </DashboardContent>
    </DashboardSubpageLayout>
  );
}
