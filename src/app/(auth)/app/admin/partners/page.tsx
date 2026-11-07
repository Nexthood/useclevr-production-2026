import {
  DashboardContent,
  DashboardSubpageLayout,
} from "@/components/layout/dashboard-subpage-layout";
import { PartnerAdmin } from "@/components/partners/partner-admin";
export default function PartnersAdminPage() {
  return (
    <DashboardSubpageLayout
      title="Partner administration"
      description="Atlas Mega Ventures LLC · UseClevr Global Partner Program"
    >
      <DashboardContent>
        <PartnerAdmin />
      </DashboardContent>
    </DashboardSubpageLayout>
  );
}
