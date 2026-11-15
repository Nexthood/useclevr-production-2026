import { NativeSigning } from "@/components/partners/native-signing";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Sign Partner Agreement | UseClevr",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function PartnerSigningPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-5 py-14">
      <h1 className="text-3xl font-semibold">Sign your partner agreement</h1>
      <NativeSigning />
    </main>
  );
}
