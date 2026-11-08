import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { PartnerApplication } from "@/components/partners/partner-application";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Apply to the Global Partner Program | UseClevr",
  robots: { index: false, follow: false },
};
export default async function PartnerApplyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=%2Fpartners%2Fapply");
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-5 py-12">
      <h1 className="text-3xl font-semibold">Global Partner Program</h1>
      <PartnerApplication />
    </main>
  );
}
