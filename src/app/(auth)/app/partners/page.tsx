import {
  DashboardContent,
  DashboardSubpageLayout,
} from "@/components/layout/dashboard-subpage-layout";
import { PartnerPortal } from "@/components/partners/partner-portal";
export default function PartnersPage() {
  return (
    <DashboardSubpageLayout
      title="Global Partner Program"
      description="Your customers, partner level, commissions, and settlements."
    >
      <DashboardContent>
        <PartnerPortal />
      </DashboardContent>
    </DashboardSubpageLayout>
  );
}
