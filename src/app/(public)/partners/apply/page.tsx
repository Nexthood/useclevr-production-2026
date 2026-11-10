import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { PartnerApplication } from "@/components/partners/partner-application";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Apply to the Global Partner Program | UseClevr",
  robots: { index: false, follow: false },
};
export default async function PartnerApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ partnershipType?: string }>;
}) {
  const { partnershipType } = await searchParams;
  const callback =
    "/partners/apply" +
    (partnershipType ? "?partnershipType=" + encodeURIComponent(partnershipType) : "");
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=" + encodeURIComponent(callback));
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-5 py-12">
      <h1 className="text-3xl font-semibold">Global Partner Program</h1>
      <PartnerApplication partnershipType={partnershipType} />
    </main>
  );
}
