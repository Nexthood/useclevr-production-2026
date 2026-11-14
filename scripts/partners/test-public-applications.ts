import { invitationFailure, onboardingLoginUrl } from "../../src/lib/partners/onboarding";
import assert from "node:assert/strict";
import {
  createInvitation,
  hashInvitation,
  publicApplicationSchema,
} from "../../src/lib/partners/public-applications";

const base = {
  program: "work_with_us",
  category: "Referral Partner",
  fullName: "Taylor Partner",
  email: "Taylor@example.com",
  country: "nl",
  companyName: "",
  experience: "We advise local organizations on software adoption and business reporting.",
  privacyAccepted: true,
  website: "",
  formStartedAt: Date.now() - 5000,
};
const accepted = publicApplicationSchema.safeParse(base);
assert.equal(accepted.success, true);
if (accepted.success) {
  assert.equal(accepted.data.email, "taylor@example.com");
  assert.equal(accepted.data.country, "NL");
  assert.equal(accepted.data.companyName, null);
}
assert.equal(
  publicApplicationSchema.safeParse({
    ...base,
    program: "work_with_us",
    category: "Authorized Reseller",
  }).success,
  false,
);
assert.equal(
  publicApplicationSchema.safeParse({ ...base, fullName: "<script>alert(1)</script>" }).success,
  false,
);
assert.equal(publicApplicationSchema.safeParse({ ...base, privacyAccepted: false }).success, false);
assert.equal(publicApplicationSchema.safeParse({ ...base, extra: "unexpected" }).success, false);
const invitation = createInvitation();
assert.equal(invitation.token.length >= 32, true);
assert.equal(invitation.hash, hashInvitation(invitation.token));
assert.notEqual(invitation.hash, invitation.token);
console.log(
  "PASS public partner application validation, program separation, privacy acceptance, and invitation hashing",
);

const now = new Date("2026-11-12T12:00:00Z");
const eligible = {
  invitationHash: invitation.hash,
  email: "taylor@example.com",
  status: "approved",
  invitationUsedAt: null,
  onboardedAt: null,
  invitationExpiresAt: new Date(now.getTime() + 1000),
};
assert.equal(invitationFailure(eligible, invitation.hash, "TAYLOR@example.com", now), null);
assert.equal(invitationFailure(null, invitation.hash, eligible.email, now), "invalid_invitation");
assert.equal(
  invitationFailure(eligible, "unmatched-hash", eligible.email, now),
  "invalid_invitation",
);
assert.equal(
  invitationFailure(
    { ...eligible, invitationExpiresAt: null },
    invitation.hash,
    eligible.email,
    now,
  ),
  "invalid_invitation",
);
assert.equal(
  invitationFailure(
    { ...eligible, invitationExpiresAt: now },
    invitation.hash,
    eligible.email,
    now,
  ),
  "expired_invitation",
);
assert.equal(
  invitationFailure(
    { ...eligible, invitationUsedAt: now, status: "active" },
    invitation.hash,
    eligible.email,
    now,
  ),
  "used_invitation",
);
assert.equal(
  invitationFailure({ ...eligible, onboardedAt: now }, invitation.hash, eligible.email, now),
  "used_invitation",
);
assert.equal(
  invitationFailure(eligible, invitation.hash, "other@example.com", now),
  "incorrect_account",
);
assert.equal(
  invitationFailure({ ...eligible, status: "rejected" }, invitation.hash, eligible.email, now),
  "invalid_invitation",
);
const loginUrl = new URL(onboardingLoginUrl(invitation.token), "https://app.useclevr.com");
const callback = new URL(loginUrl.searchParams.get("callbackUrl")!, loginUrl.origin);
assert.equal(loginUrl.pathname, "/login");
assert.equal(callback.pathname, "/partners/onboard");
assert.ok(
  callback.searchParams.get("token") === invitation.token,
  "the local callback preserves the invitation without printing it",
);
console.log(
  "PASS distinct invitation outcomes, exclusive expiry boundary, completed-state defense, and fixed same-origin sign-in callback",
);
