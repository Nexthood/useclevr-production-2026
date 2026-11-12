import { featureEnabled } from "@/lib/partners/contracts/domain";
import { auth } from "@/lib/auth/auth";
import { onboardingLoginUrl } from "@/lib/partners/onboarding";
import { PartnerOnboarding } from "@/components/partners/partner-onboarding";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Complete Partner Onboarding | UseClevr",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function PartnerOnboardPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const session = await auth();
  return (
    <main className="mx-auto max-w-2xl px-5 py-14">
      <section className="space-y-5 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          UseClevr Partner Program
        </p>
        <h1 className="text-3xl font-semibold">Complete partner onboarding</h1>
        {token.length < 32 || token.length > 100 ? (
          <p role="alert">This invitation link is invalid.</p>
        ) : session?.user?.id ? (
          <PartnerOnboarding token={token} contractsEnabled={featureEnabled()} />
        ) : (
          <>
            <p className="leading-7 text-muted-foreground">
              Sign in or create a UseClevr account with the same verified email address that
              received your invitation. Partner activation requires a separate administrator
              decision.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                className="inline-flex min-h-12 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground"
                href={onboardingLoginUrl(token)}
                rel="noreferrer"
              >
                Sign in or create an account
              </a>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
