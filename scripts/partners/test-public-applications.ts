import assert from "node:assert/strict";
import { createInvitation, hashInvitation, publicApplicationSchema } from "../../src/lib/partners/public-applications";

const base = {
  program: "work_with_us", category: "Referral Partner", fullName: "Taylor Partner",
  email: "Taylor@example.com", country: "nl", companyName: "",
  experience: "We advise local organizations on software adoption and business reporting.",
  privacyAccepted: true, website: "", formStartedAt: Date.now() - 5000,
};
const accepted = publicApplicationSchema.safeParse(base);
assert.equal(accepted.success, true);
if (accepted.success) {
  assert.equal(accepted.data.email, "taylor@example.com");
  assert.equal(accepted.data.country, "NL");
  assert.equal(accepted.data.companyName, null);
}
assert.equal(publicApplicationSchema.safeParse({ ...base, program: "work_with_us", category: "Authorized Reseller" }).success, false);
assert.equal(publicApplicationSchema.safeParse({ ...base, fullName: "<script>alert(1)</script>" }).success, false);
assert.equal(publicApplicationSchema.safeParse({ ...base, privacyAccepted: false }).success, false);
assert.equal(publicApplicationSchema.safeParse({ ...base, extra: "unexpected" }).success, false);
const invitation = createInvitation();
assert.equal(invitation.token.length >= 32, true);
assert.equal(invitation.hash, hashInvitation(invitation.token));
assert.notEqual(invitation.hash, invitation.token);
console.log("PASS public partner application validation, program separation, privacy acceptance, and invitation hashing");
