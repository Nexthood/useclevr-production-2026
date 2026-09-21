import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildContactMessageProblemAnswer,
  buildContactMessagePrompt,
  buildConfirmedUsyContactPayload,
  missingContactFields,
  usyContactMessageMaxLength,
  usyContactMessageMinLength,
  validateContactMessage,
  validateUsyContactPayload,
} from "@/lib/usy/contact";
import { buildUsyReply } from "@/lib/usy/router";
import type { SupportedUsyLanguage, UsyContactDraft, UsyContext } from "@/lib/usy/types";

const repoRoot = resolve(import.meta.dirname, "../..");

function guestContext(): UsyContext {
  return {
    audience: "public",
    role: "public",
    route: "/pricing",
    usage: null,
    isAuthenticated: false,
  };
}

const baseContext: UsyContext = {
  audience: "dashboard",
  role: "user",
  route: "/app",
  plan: "free",
  usage: {
    subscriptionTier: "free",
    analysisCount: 1,
    total: 2,
    limitReached: false,
  },
};

function departmentDraft(category: NonNullable<UsyContactDraft["category"]>): UsyContactDraft {
  return { category, language: "english" };
}

// ---------------------------------------------------------------------------
// Message validation rules (10–500 characters, trimmed)
// ---------------------------------------------------------------------------

function testMessageValidationRules() {
  assert.deepEqual(validateContactMessage(""), { ok: false, reason: "empty" }, "empty message rejected");
  assert.deepEqual(validateContactMessage("   \n\t "), { ok: false, reason: "empty" }, "whitespace-only message rejected");
  assert.deepEqual(validateContactMessage("short"), { ok: false, reason: "too_short" }, "message under 10 characters rejected");
  assert.equal(validateContactMessage("0123456789").ok, true, "exactly 10 characters accepted");
  assert.equal(
    validateContactMessage("a".repeat(usyContactMessageMaxLength)).ok,
    true,
    "exactly 500 characters accepted",
  );
  assert.deepEqual(
    validateContactMessage("a".repeat(usyContactMessageMaxLength + 1)),
    { ok: false, reason: "too_long" },
    "501 characters rejected",
  );
  const whitespacePadded = validateContactMessage("   Please help with my billing invoice.   ");
  assert.equal(whitespacePadded.ok, true);
  if (whitespacePadded.ok) {
    assert.equal(
      whitespacePadded.message,
      "Please help with my billing invoice.",
      "leading/trailing whitespace is normalized",
    );
  }
  assert.equal(usyContactMessageMinLength, 10);
  assert.equal(usyContactMessageMaxLength, 500);
}

// ---------------------------------------------------------------------------
// Staged flow: department selection opens the dedicated message step
// ---------------------------------------------------------------------------

function testDepartmentSelectionOpensMessageStep() {
  const initial = buildUsyReply({
    question: "I want to contact the team",
    context: guestContext(),
  });

  assert.equal(initial.intent, "contact_request");
  assert.equal(initial.contactDraft?.category, undefined, "no department is guessed from a generic request");
  assert.equal(initial.contactDraft?.awaitingConfirmation, false);
  assert.doesNotMatch(initial.answer, /your name|reply email/i, "contact details are not requested up front");
  assert.ok(initial.followUps.includes("Billing"), "department chips are offered");

  const billingSelected = buildUsyReply({
    question: "Billing",
    context: guestContext(),
    contactDraft: initial.contactDraft,
  });

  assert.equal(billingSelected.intent, "contact_request");
  assert.equal(billingSelected.contactDraft?.category, "billing", "Billing selection preserves the billing department");
  assert.equal(billingSelected.messageInput, true, "department selection opens the dedicated message step");
  assert.match(billingSelected.answer, /Please describe your request/);
  assert.doesNotMatch(billingSelected.answer, /your name|reply email/i, "contact details are not mixed into the message step");
  assert.deepEqual(billingSelected.followUps, [], "no department chips remain once the department is selected");
}

const departmentCases = [
  { label: "Sales", expected: "sales" },
  { label: "Technical Support", expected: "technical_support" },
  { label: "Billing", expected: "billing" },
  { label: "Management", expected: "management" },
  { label: "Executive Management", expected: "executive" },
] as const;

function testDepartmentRoutingPreservedThroughMessageStep() {
  for (const item of departmentCases) {
    const selected = buildUsyReply({
      question: item.label,
      context: guestContext(),
      contactDraft: { language: "english" },
    });

    assert.equal(selected.contactDraft?.category, item.expected, `${item.label} maps to ${item.expected}`);
    assert.equal(selected.messageInput, true, `${item.label} selection opens the message step`);

    const withMessage = buildUsyReply({
      question: "Please help me with an urgent request about my account.",
      context: guestContext(),
      contactDraft: selected.contactDraft,
    });

    assert.equal(
      withMessage.contactDraft?.category,
      item.expected,
      `${item.expected} department survives the message step`,
    );
    assert.match(withMessage.answer, /contact details/i, `${item.expected} flow proceeds to contact details`);
    assert.equal(withMessage.messageInput, undefined, "message step closes after a valid message");
  }
}

// ---------------------------------------------------------------------------
// Message step validation through the chat router
// ---------------------------------------------------------------------------

function testMessageStepRejectsInvalidMessages() {
  const step = buildUsyReply({
    question: "Contact the billing team",
    context: guestContext(),
  });
  assert.equal(step.contactDraft?.category, "billing");
  assert.equal(step.messageInput, true);

  const tooShort = buildUsyReply({
    question: "Help me",
    context: guestContext(),
    contactDraft: step.contactDraft,
  });
  assert.equal(tooShort.messageInput, true, "message step stays open");
  assert.equal(tooShort.contactDraft?.message, undefined, "too-short message is not stored");
  assert.match(tooShort.answer, /at least 10 characters/);

  const tooLong = buildUsyReply({
    question: "a".repeat(501),
    context: guestContext(),
    contactDraft: step.contactDraft,
  });
  assert.equal(tooLong.messageInput, true, "message step stays open after an over-long message");
  assert.equal(tooLong.contactDraft?.message, undefined, "501-character message is not stored");
  assert.match(tooLong.answer, /500 characters/);

  const whitespaceOnly = buildUsyReply({
    question: "   ",
    context: guestContext(),
    contactDraft: step.contactDraft,
  });
  assert.equal(whitespaceOnly.contactDraft?.message, undefined, "whitespace-only message is rejected");
  assert.equal(whitespaceOnly.messageInput, true);

  const empty = buildUsyReply({
    question: "",
    context: guestContext(),
    contactDraft: step.contactDraft,
  });
  assert.equal(empty.contactDraft?.message, undefined, "empty message is rejected");
}

function testMessageStepAcceptsBoundaryLengths() {
  const exactlyTen = buildUsyReply({
    question: "0123456789",
    context: guestContext(),
    contactDraft: departmentDraft("billing"),
  });
  assert.equal(exactlyTen.contactDraft?.message, "0123456789", "exactly 10 characters accepted");
  assert.match(exactlyTen.answer, /contact details/i, "valid message proceeds to contact details");

  const exactlyFiveHundred = buildUsyReply({
    question: "b".repeat(500),
    context: guestContext(),
    contactDraft: departmentDraft("billing"),
  });
  assert.equal(exactlyFiveHundred.contactDraft?.message?.length, 500, "exactly 500 characters accepted");
  assert.match(exactlyFiveHundred.answer, /contact details/i);
}

function testMessageStepKeepsExactTypedTextInPayload() {
  // Marker words ("about", "regarding", "issue is") occur naturally in a real
  // request; the webhook payload must carry the exact typed message instead of
  // an extraction fragment cut at the marker and the 120-character field cap.
  const typed = "Our invoice 4471 shows 21% VAT but we are exempt as a charity. Please correct the last two invoices and confirm our billing email. I have a question about the VAT certificate you need.";

  const step = buildUsyReply({
    question: typed,
    context: guestContext(),
    contactDraft: departmentDraft("billing"),
  });

  assert.equal(step.contactDraft?.message, typed, "the dedicated message step stores the exact typed text");
  assert.equal(
    step.contactDraft?.message?.length,
    typed.length,
    "the message is not truncated to the 120-character extraction cap",
  );

  const multiLineInput = "Our invoice 4471 is wrong.\nThe VAT total does not match the order.\nPlease correct both lines and resend it.";
  const multiLine = buildUsyReply({
    question: multiLineInput,
    context: guestContext(),
    contactDraft: departmentDraft("billing"),
  });
  assert.equal(multiLine.contactDraft?.message, multiLineInput, "multi-line message-step text stays verbatim");
}

function testOneShotExplicitMessageIsNotTruncated() {
  const expected = "Please fix our VAT setup; our invoice 4471 shows 21% but we are exempt; also our billing email changed to finance@company.com; please update both invoices and reply today.";
  const oneShot = `Contact billing. Message: ${expected} My name is Alex Rivera, alex@example.com`;

  const reply = buildUsyReply({ question: oneShot, context: guestContext() });

  const storedMessage = `${expected} My name is Alex Rivera, alex@example.com`;
  assert.equal(reply.contactDraft?.message?.length, storedMessage.length, "one-shot explicit messages are not cut at 120 characters");
  assert.equal(reply.contactDraft?.message, storedMessage, "the full request text after the marker reaches the payload");
  assert.ok(reply.contactDraft?.awaitingConfirmation, "the combined one-shot still completes the flow");
}

// ---------------------------------------------------------------------------
// Server-side payload validation (501 characters rejected at the handoff gate)
// ---------------------------------------------------------------------------

function testServerRejectsInvalidContactPayloads() {
  const validMessage = "Please correct the VAT number on invoice 4471.";

  const tooLong = validateUsyContactPayload({
    category: "billing",
    message: "a".repeat(501),
    senderName: "Alex Rivera",
    replyEmail: "alex@example.com",
    language: "english",
    confirmed: true,
  });
  assert.equal(tooLong.success, false, "501-character message rejected server-side");

  const tooShort = validateUsyContactPayload({
    category: "billing",
    message: "Invoice",
    senderName: "Alex Rivera",
    replyEmail: "alex@example.com",
    language: "english",
    confirmed: true,
  });
  assert.equal(tooShort.success, false, "message under 10 characters rejected server-side");

  const whitespaceOnly = validateUsyContactPayload({
    category: "billing",
    message: "            ",
    senderName: "Alex Rivera",
    replyEmail: "alex@example.com",
    language: "english",
    confirmed: true,
  });
  assert.equal(whitespaceOnly.success, false, "whitespace-only message rejected server-side");

  const unknownDepartment = validateUsyContactPayload({
    category: "random_department",
    message: validMessage,
    senderName: "Alex Rivera",
    replyEmail: "alex@example.com",
    language: "english",
    confirmed: true,
  });
  assert.equal(unknownDepartment.success, false, "unknown department rejected");

  const missingName = validateUsyContactPayload({
    category: "billing",
    message: validMessage,
    senderName: "",
    replyEmail: "alex@example.com",
    language: "english",
    confirmed: true,
  });
  assert.equal(missingName.success, false, "name is required");

  const invalidEmail = validateUsyContactPayload({
    category: "billing",
    message: validMessage,
    senderName: "Alex Rivera",
    replyEmail: "not-an-email",
    language: "english",
    confirmed: true,
  });
  assert.equal(invalidEmail.success, false, "valid reply email is required");

  const unsupportedLanguage = validateUsyContactPayload({
    category: "billing",
    message: validMessage,
    senderName: "Alex Rivera",
    replyEmail: "alex@example.com",
    language: "french",
    confirmed: true,
  });
  assert.equal(unsupportedLanguage.success, false, "unsupported language rejected");

  const unconfirmed = validateUsyContactPayload({
    category: "billing",
    message: validMessage,
    senderName: "Alex Rivera",
    replyEmail: "alex@example.com",
    language: "english",
    confirmed: false,
  });
  assert.equal(unconfirmed.success, false, "confirmation is still required before submission");
}

// ---------------------------------------------------------------------------
// Company stays optional; name and reply email stay required
// ---------------------------------------------------------------------------

function testContactFieldRequirements() {
  const noCompany = validateUsyContactPayload({
    category: "billing",
    message: "Please correct the VAT number on invoice 4471.",
    senderName: "Alex Rivera",
    replyEmail: "alex@example.com",
    language: "english",
    confirmed: true,
  });
  assert.equal(noCompany.success, true, "company remains optional");

  const draft: UsyContactDraft = {
    category: "billing",
    message: "Please correct the VAT number on invoice 4471.",
    replyEmail: "alex@example.com",
    language: "english",
  };
  assert.deepEqual(
    missingContactFields(draft),
    ["senderName"],
    "only the name is missing when message and reply email exist",
  );
}

// ---------------------------------------------------------------------------
// Guest and authenticated contact flows end in the same confirmation step
// ---------------------------------------------------------------------------

function testGuestContactFlowReachesConfirmation() {
  const initial = buildUsyReply({ question: "Contact billing", context: guestContext() });
  const messageStep = buildUsyReply({
    question: "Please help with an invoice mismatch",
    context: guestContext(),
    contactDraft: initial.contactDraft,
  });
  assert.equal(messageStep.contactDraft?.message, "Please help with an invoice mismatch");
  assert.match(messageStep.answer, /contact details/i);

  const details = buildUsyReply({
    question: "My name is Alex Rivera, alex@example.com",
    context: guestContext(),
    contactDraft: messageStep.contactDraft,
  });
  assert.equal(details.contactDraft?.awaitingConfirmation, true, "guest flow reaches the confirmation step");
  assert.equal(details.contactDraft?.category, "billing");
  assert.match(details.answer, /Please confirm before I send this contact request/);

  const confirm = buildUsyReply({
    question: "confirm",
    context: guestContext(),
    contactDraft: details.contactDraft,
  });
  assert.equal(confirm.action, "submit_contact", "guest confirmation submits through the existing handoff");
}

function testAuthenticatedContactKeepsMessageRequirement() {
  // Session-derived contact details let an authenticated user skip the details
  // step, but the message step is still mandatory.
  const draft: UsyContactDraft = {
    category: "billing",
    senderName: "Alex Rivera",
    replyEmail: "alex@example.com",
    language: "english",
  };

  const withMessage = buildUsyReply({
    question: "Why was my last invoice charged twice?",
    context: baseContext,
    contactDraft: draft,
  });
  assert.equal(withMessage.contactDraft?.message, "Why was my last invoice charged twice?", "message stored verbatim");
  assert.equal(withMessage.contactDraft?.category, "billing");
  assert.equal(withMessage.contactDraft?.awaitingConfirmation, true, "authenticated flow reaches confirmation once the message exists");
  assert.equal(withMessage.messageInput, undefined, "no message step after a valid message");
  assert.match(withMessage.answer, /Please confirm before I send this contact request/);
}

function testProductQuestionsStillWorkDuringContactFlow() {
  const completeDraft: UsyContactDraft = {
    category: "billing",
    message: "Please correct the VAT number on invoice 4471.",
    senderName: "Alex Rivera",
    replyEmail: "alex@example.com",
    language: "english",
    awaitingConfirmation: false,
  };

  const productQuestion = buildUsyReply({
    question: "Which file formats can I upload?",
    context: guestContext(),
    contactDraft: completeDraft,
  });
  assert.equal(productProductIntent(productQuestion), true, "product questions still get product answers during contact collection");

  const freshProduct = buildUsyReply({ question: "What is UseClevr?", context: guestContext() });
  assert.equal(freshProduct.intent, "product_information", "public product questions keep working without a contact draft");

  const freshPricing = buildUsyReply({ question: "What are your pricing plans?", context: guestContext() });
  assert.match(freshPricing.answer, /Free includes 2 AI credits/, "public pricing answers keep working without a contact draft");
}

function productProductIntent(response: ReturnType<typeof buildUsyReply>) {
  return response.intent === "getting_started" && /\.csv/i.test(response.answer);
}

// ---------------------------------------------------------------------------
// Final n8n handoff payload keeps the structured contract
// ---------------------------------------------------------------------------

function testFinalHandoffPayload() {
  const parsed = validateUsyContactPayload({
    category: "billing",
    message: "  Please correct the VAT number on invoice 4471.  ",
    senderName: "Alex Rivera",
    company: "",
    replyEmail: "alex@example.com",
    language: "english",
    confirmed: true,
  });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  assert.equal(parsed.data.message, "Please correct the VAT number on invoice 4471.", "payload message is normalized");

  const payload = buildConfirmedUsyContactPayload(parsed.data, {
    timestamp: "2026-09-20T12:00:00.000Z",
    userId: "user_123",
    organizationId: "business_123",
  });

  assert.equal(payload.category, "billing", "handoff keeps department");
  assert.equal(payload.message, "Please correct the VAT number on invoice 4471.", "handoff keeps the message");
  assert.equal(payload.senderName, "Alex Rivera", "handoff keeps the name");
  assert.equal(payload.replyEmail, "alex@example.com", "handoff keeps the reply email");
  assert.equal(payload.language, "english", "handoff keeps the language");
  assert.equal(payload.timestamp, "2026-09-20T12:00:00.000Z");
  assert.equal(payload.userId, "user_123");
  assert.equal(payload.organizationId, "business_123");
  assert.equal(payload.company, undefined, "empty company stays out of the handoff");

  const withCompany = buildConfirmedUsyContactPayload(
    { ...parsed.data, company: "Delta Labs" },
    { timestamp: "2026-09-20T12:00:00.000Z" },
  );
  assert.equal(withCompany.company, "Delta Labs", "optional company reaches the handoff when provided");
}

// ---------------------------------------------------------------------------
// Identity, handoff reuse, and no parallel email logic (source assertions)
// ---------------------------------------------------------------------------

function testIdentityComesFromServerSessionOnly() {
  const contactRoute = readProjectFile("src/app/api/usy/contact/route.ts");
  assert.ok(contactRoute.includes("const session = await auth()"), "contact route reads the verified server session");
  assert.ok(
    contactRoute.includes("const userId = session?.user?.id ?? null"),
    "account reference is derived from the verified session, not the client",
  );
  assert.ok(
    contactRoute.includes("buildConfirmedUsyContactPayload(parsed.data, { userId, organizationId })"),
    "handoff metadata is built server-side",
  );
  assert.doesNotMatch(contactRoute, /body\.userId|parsed\.data\.userId/, "client-supplied identity is ignored");

  const chatRoute = readProjectFile("src/app/api/usy/chat/route.ts");
  assert.ok(
    chatRoute.includes("withSessionContactDefaults(parsed.data.contactDraft, session?.user)"),
    "authenticated contact details are prefilled from the verified session only",
  );
  assert.ok(chatRoute.includes("senderName: z.string().max(120)"), "draft name length is bounded at the boundary");
  assert.ok(chatRoute.includes("replyEmail: z.string().max(254)"), "draft email length is bounded at the boundary");
  assert.ok(chatRoute.includes("message: z.string().max(2000)"), "draft message length is bounded at the boundary");
}

function testExistingHandoffReusedWithoutParallelEmailLogic() {
  const emailLibraryPattern = /\b(nodemailer|smtp|sendgrid|resend|mailgun|postmark|amazon ses)\b/i;
  const contactLib = readProjectFile("src/lib/usy/contact.ts");
  assert.ok(contactLib.includes("USY_CONTACT_N8N_WEBHOOK_URL"), "existing n8n webhook config is reused");
  assert.ok(contactLib.includes("getUsyContactWebhookConfig"), "existing handoff layer is reused");
  assert.ok(
    contactLib.includes('"X-UseClevr-Event": "usy.contact_request"'),
    "existing n8n event contract is preserved in the central webhook sender",
  );
  assert.doesNotMatch(contactLib, emailLibraryPattern, "no parallel email logic introduced");

  const contactRoute = readProjectFile("src/app/api/usy/contact/route.ts");
  assert.ok(contactRoute.includes("sendUsyContactWebhook"), "the route submits through the central webhook sender");
  assert.ok(contactRoute.includes("checkUsyContactRateLimit"), "existing rate limiting is preserved");
  assert.doesNotMatch(contactRoute, emailLibraryPattern, "no parallel email logic in the route");

  const router = readProjectFile("src/lib/usy/router.ts");
  assert.ok(router.includes("messageInput: true"), "router signals the dedicated message step to the chat UI");
}

function testMessageStepLocalizedAcrossSupportedLanguages() {
  const cases: Array<{ language: SupportedUsyLanguage; promptPattern: RegExp; problemPattern: RegExp }> = [
    { language: "english", promptPattern: /Please describe your request/, problemPattern: /at least 10 characters/ },
    { language: "german", promptPattern: /Bitte beschreibe dein Anliegen/, problemPattern: /mindestens 10 Zeichen/ },
    { language: "dutch", promptPattern: /Beschrijf alstublieft je verzoek/, problemPattern: /minimaal 10 tekens/ },
    { language: "spanish", promptPattern: /describe tu solicitud/i, problemPattern: /al menos 10 caracteres/ },
    { language: "hungarian", promptPattern: /írd le a kérésedet/i, problemPattern: /legalább 10 karakter/ },
    { language: "romanian", promptPattern: /descrii cererea ta/i, problemPattern: /cel puțin 10 caractere/ },
  ];

  for (const item of cases) {
    assert.match(
      buildContactMessagePrompt(item.language),
      item.promptPattern,
      `${item.language} message prompt is localized`,
    );
    assert.match(
      buildContactMessageProblemAnswer("too_short", item.language),
      item.problemPattern,
      `${item.language} message validation is localized`,
    );
  }
}

function testGermanMessageStepFlow() {
  const initial = buildUsyReply({ question: "Kontaktiere Billing", context: guestContext() });
  assert.equal(initial.contactDraft?.category, "billing");
  assert.equal(initial.messageInput, true);
  assert.match(initial.answer, /Bitte beschreibe dein Anliegen/);

  const tooShort = buildUsyReply({ question: "Rechnung", context: guestContext(), contactDraft: initial.contactDraft });
  assert.match(tooShort.answer, /mindestens 10 Zeichen/, "German message validation stays localized");
  assert.equal(tooShort.contactDraft?.message, undefined);

  const valid = buildUsyReply({
    question: "Bitte korrigiert die Mehrwertsteuer auf Rechnung 4471.",
    context: guestContext(),
    contactDraft: initial.contactDraft,
  });
  assert.equal(valid.contactDraft?.language, "german");
  assert.match(valid.answer, /Kontaktdaten/);
}

function testCancelWorksFromMessageStep() {
  const initial = buildUsyReply({ question: "Contact billing", context: guestContext() });
  assert.equal(initial.contactDraft?.category, "billing");

  const cancelled = buildUsyReply({
    question: "cancel",
    context: guestContext(),
    contactDraft: initial.contactDraft,
  });
  assert.equal(cancelled.contactDraft, null, "cancel from the message step clears the draft");
  assert.equal(cancelled.action, "clear_contact");
  assert.match(cancelled.answer, /not sent/i);

  const normalMessageNotCancelled = buildUsyReply({
    question: "No worries, but my invoice number 4471 shows the wrong VAT total.",
    context: guestContext(),
    contactDraft: initial.contactDraft,
  });
  assert.notEqual(normalMessageNotCancelled.action, "clear_contact", "a real message is not treated as a cancel command");
  assert.equal(normalMessageNotCancelled.contactDraft?.message, "No worries, but my invoice number 4471 shows the wrong VAT total.");
}

function readProjectFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

testMessageValidationRules();
testDepartmentSelectionOpensMessageStep();
testDepartmentRoutingPreservedThroughMessageStep();
testMessageStepRejectsInvalidMessages();
testMessageStepAcceptsBoundaryLengths();
testMessageStepKeepsExactTypedTextInPayload();
testOneShotExplicitMessageIsNotTruncated();
testServerRejectsInvalidContactPayloads();
testContactFieldRequirements();
testGuestContactFlowReachesConfirmation();
testAuthenticatedContactKeepsMessageRequirement();
testProductQuestionsStillWorkDuringContactFlow();
testFinalHandoffPayload();
testIdentityComesFromServerSessionOnly();
testExistingHandoffReusedWithoutParallelEmailLogic();
testMessageStepLocalizedAcrossSupportedLanguages();
testGermanMessageStepFlow();
testCancelWorksFromMessageStep();

console.warn("Usy contact message step tests passed");
