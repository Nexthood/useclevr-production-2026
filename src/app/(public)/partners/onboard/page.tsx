import { InvitationOnboarding } from "@/components/partners/invitation-onboarding";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Partner onboarding | UseClevr",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  return (
    <main className="mx-auto max-w-3xl px-5 py-14">
      <section className="space-y-6 rounded-lg border bg-card p-6 sm:p-9">
        <h1 className="text-3xl font-semibold">Partner onboarding</h1>
        {/^[A-Za-z0-9_-]{32,100}$/.test(token) ? (
          <InvitationOnboarding token={token} />
        ) : (
          <p role="alert">
            This invitation link is invalid. Open the complete link from your invitation email.
          </p>
        )}
      </section>
    </main>
  );
}
