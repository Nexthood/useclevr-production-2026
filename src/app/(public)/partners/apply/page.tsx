import { PartnerApplication } from "@/components/partners/partner-application";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Apply to the Global Partner Program | UseClevr",
  robots: { index: false, follow: false },
};
export default async function PartnerApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ partnershipType?: string; program?: string }>;
}) {
  const { partnershipType, program } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-5 py-12 sm:py-16">
      <header className="max-w-3xl space-y-4"><p className="text-sm font-semibold uppercase tracking-[.16em] text-primary">UseClevr Global Partner Program</p><h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Let’s build better business insight together.</h1><p className="text-lg leading-8 text-muted-foreground">Apply to introduce UseClevr to your customers. No customer account is required to apply.</p></header>
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-9"><PartnerApplication partnershipType={partnershipType} program={program} /></section>
    </main>
  );
}
