import { auth } from "@/lib/auth/auth";
import { PartnerContracts } from "@/components/partners/partner-contracts";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Partner Agreements | UseClevr",
  robots: { index: false, follow: false },
};
export default async function ContractsPage() {
  const session = await auth();
  return (
    <main className="mx-auto max-w-4xl px-5 py-14">
      <h1 className="mb-6 text-3xl font-semibold">Partner agreements</h1>
      {session?.user?.id ? (
        <PartnerContracts />
      ) : (
        <a className="underline" href="/login?callbackUrl=%2Fpartners%2Fcontracts">
          Sign in with your verified partner account
        </a>
      )}
    </main>
  );
}
