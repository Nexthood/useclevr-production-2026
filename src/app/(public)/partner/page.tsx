import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { PartnerPortal } from "@/components/partners/partner-portal";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Partner Portal | UseClevr",
  robots: { index: false, follow: false },
};
export default async function PartnerPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/partner/login");
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-5 py-10">
      <header>
        <p className="text-sm font-semibold text-primary">UseClevr Global Partner Program</p>
        <h1 className="text-3xl font-semibold">Partner portal</h1>
      </header>
      <PartnerPortal />
    </main>
  );
}
