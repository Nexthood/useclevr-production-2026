export const onboardingFailures = {
  authentication_required: {
    status: 401,
    error: "Sign in with the account that received this invitation to continue.",
  },
  email_verification_required: {
    status: 403,
    error: "Verify your UseClevr account email before continuing.",
  },
  incorrect_account: {
    status: 403,
    error:
      "You are signed in with a different account. Sign in with the verified email address that received this invitation.",
  },
  expired_invitation: {
    status: 410,
    error: "This invitation has expired. Contact the partner team for a new invitation.",
  },
  used_invitation: {
    status: 409,
    error: "This invitation has already been used. Partner onboarding is already complete.",
  },
  invalid_invitation: {
    status: 403,
    error:
      "This invitation is invalid. Open the complete link from your approval email or contact the partner team.",
  },
  onboarding_unavailable: {
    status: 503,
    error: "Onboarding is temporarily unavailable. Please try again or contact the partner team.",
  },
} as const;

export type OnboardingFailureCode = keyof typeof onboardingFailures;

type Invitation = {
  invitationHash: string | null;
  email: string;
  status: string;
  invitationUsedAt: Date | null;
  onboardedAt: Date | null;
  invitationExpiresAt: Date | null;
};

// Call only after authentication and database email verification. Never return recipient details.
export function invitationFailure(
  invitation: Invitation | null | undefined,
  tokenHash: string,
  verifiedEmail: string,
  now = new Date(),
): OnboardingFailureCode | null {
  if (!invitation || invitation.invitationHash !== tokenHash) return "invalid_invitation";
  if (invitation.email.toLowerCase() !== verifiedEmail.toLowerCase()) return "incorrect_account";
  if (invitation.invitationUsedAt || invitation.onboardedAt) return "used_invitation";
  if (invitation.status !== "approved" || !invitation.invitationExpiresAt)
    return "invalid_invitation";
  if (invitation.invitationExpiresAt <= now) return "expired_invitation";
  return null;
}

export class OnboardingInvitationError extends Error {
  constructor(public readonly code: OnboardingFailureCode) {
    super(code);
    this.name = "OnboardingInvitationError";
  }
}

// Both destinations are fixed same-origin routes; no caller-controlled redirect target is accepted.
export function onboardingLoginUrl(token: string) {
  const callback = "/partners/onboard?token=" + encodeURIComponent(token);
  return "/login?callbackUrl=" + encodeURIComponent(callback);
}
