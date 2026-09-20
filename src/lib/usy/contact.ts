import { checkRateLimit } from "@/lib/utils/rate-limiter";
import { normalizeUsyText } from "@/lib/usy/language";
import { usyContactCategories, usyProductFacts } from "@/lib/usy/knowledge-base";
import type { SupportedUsyLanguage, UsyContactCategory, UsyContactDraft } from "@/lib/usy/types";
import { z } from "zod";

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export const usyContactMessageMinLength = 10;
export const usyContactMessageMaxLength = 500;

export const usyContactPayloadSchema = z.object({
  category: z.enum(usyContactCategories),
  message: z
    .string()
    .trim()
    .min(usyContactMessageMinLength, "Please describe your request with at least 10 characters.")
    .max(usyContactMessageMaxLength, "Message is too long. Please keep it to 500 characters."),
  senderName: z.string().trim().min(2, "Name is required.").max(120, "Name is too long."),
  company: z.string().trim().max(120, "Company is too long.").optional().or(z.literal("")),
  replyEmail: z.string().trim().email("A valid reply email is required.").max(254),
  language: z.enum(["english", "german", "dutch", "spanish", "hungarian", "romanian"]),
  confirmed: z.literal(true),
});

export type UsyContactPayloadInput = z.input<typeof usyContactPayloadSchema>;
export type UsyContactPayload = z.output<typeof usyContactPayloadSchema>;

export type UsyWebhookPayload = {
  category: UsyContactCategory;
  message: string;
  senderName: string;
  company?: string;
  replyEmail: string;
  language: SupportedUsyLanguage;
  timestamp: string;
  userId?: string;
  organizationId?: string;
};

export type UsyContactMessageProblem = "empty" | "too_short" | "too_long";

export type UsyContactMessageCheck =
  | { ok: true; message: string }
  | { ok: false; reason: UsyContactMessageProblem };

export function validateContactMessage(raw: string | null | undefined): UsyContactMessageCheck {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return { ok: false, reason: "empty" };
  if (trimmed.length < usyContactMessageMinLength) return { ok: false, reason: "too_short" };
  if (trimmed.length > usyContactMessageMaxLength) return { ok: false, reason: "too_long" };
  return { ok: true, message: trimmed };
}

export function validateUsyContactPayload(input: unknown) {
  return usyContactPayloadSchema.safeParse(input);
}

export function detectContactCategory(message: string): UsyContactCategory | null {
  const normalized = normalizeUsyText(message);
  const categoryKeywords: Array<[UsyContactCategory, string[]]> = [
    ["executive", ["executive", "ceo", "founder", "vezetoseg", "felsovezetes", "directie", "conducere executiva"]],
    ["management", ["management", "manager", "leiding", "vezetoseg", "conducere", "geschaftsfuhrung", "geschaeftsfuehrung"]],
    ["billing", ["billing", "invoice", "invoices", "subscription", "payment", "stripe", "factuur", "factura", "rechnung", "szamla", "számla", "abonament"]],
    ["technical_support", ["technical", "support", "it", "bug", "error", "broken", "upload failed", "troubleshoot", "technisch", "technik", "suport", "tamogatas", "támogatás"]],
    ["sales", ["sales", "pricing", "demo", "upgrade", "plan", "quote", "verkauf", "vertrieb", "sales", "verkoop", "ventas", "ertekesites", "értékesítés", "vanzari", "vânzări"]],
  ];

  return categoryKeywords.find(([, keywords]) => keywords.some((keyword) => matchesKeyword(normalized, keyword)))?.[0] ?? null;
}

export function isContactRequest(message: string) {
  const normalized = normalizeUsyText(message);
  const contactVerb = /\b(contact|speak|talk|connect|reach|message|email|call|support ticket|human|agent|representative)\b/.test(normalized) ||
    /\b(kontakt|kontaktiere|kontaktieren|sprechen|spreek|contact|hablar|contactar|beszelni|kapcsolat|vorbesc|contactez)\b/.test(normalized);
  const department = /\b(sales|billing|management|executive|technical support|it support|support)\b/.test(normalized);
  return contactVerb || (department && /\b(help|request|need|want|please|with|about)\b/.test(normalized));
}

export function isConfirmation(message: string) {
  const normalized = normalizeUsyText(message);
  return /^(yes|confirm|confirmed|send|submit|ok|okay|please send|go ahead|ja|senden|bestatigen|bestaetigen|bestatig|bestaetig|verstuur|versturen|bevestig|bevestigen|enviar|confirmar|si|sí|igen|kuldd|küldd|kuld|küld|megerositem|megerősítem|da|trimite|confirma|confirmă)\b/.test(normalized);
}

export function isCancellation(message: string) {
  const normalized = normalizeUsyText(message);
  return /^(no|cancel|stop|do not send|dont send|don't send|nein|abbrechen|annuleer|annuleren|cancelar|nem|megse|mégse|nu|opreste|oprește)\b/.test(normalized);
}

export function mergeContactDraft(
  previous: UsyContactDraft | null | undefined,
  message: string,
  language: SupportedUsyLanguage,
): UsyContactDraft {
  const extractedEmail = message.match(emailPattern)?.[0];
  const category = detectContactCategory(message);
  const name = extractField(message, [
    /(?:my name is|i am|i'm|name is|ich bin|mein name ist|ik ben|mi nombre es|soy|nevem|a nevem|mă numesc|ma numesc)\s+([^.,;\n]+)/i,
  ]);
  const company = extractField(message, [
    /(?:company is|company:|from company|for company|firma|unternehmen|bedrijf|empresa|ceg|cég|compania)\s+([^.,;\n]+)/i,
  ]);
  const explicitMessage = extractField(message, [
    /(?:message is|message:|request is|request:|about|regarding|because|issue is|problem is|anliegen:|anfrage:|nachricht:|verzoek:|bericht:|mensaje:|solicitud:|problema:|uzenet:|üzenet:|keres:|kérés:|cerere:|mesaj:|problema este)\s+(.+)/i,
  ]);
  const trimmed = message.trim();
  const previousMessageCheck = validateContactMessage(previous?.message);
  const messageNotYetSet = !previousMessageCheck.ok;
  // In the dedicated message step (department already selected) the whole input
  // is the request itself, so it is accepted verbatim within 10–500 characters.
  const verbatimMessageAccepted = messageNotYetSet
    ? previous?.category
      ? trimmed.length >= usyContactMessageMinLength && trimmed.length <= usyContactMessageMaxLength
      : trimmed.length >= 20 && !isOnlyCollectionMessage(trimmed)
    : false;
  const candidateMessage = explicitMessage || (verbatimMessageAccepted ? trimmed : undefined);
  const candidateCheck = candidateMessage ? validateContactMessage(candidateMessage) : null;

  // Preserve the existing category if already set - don't overwrite with new detection
  const existingCategory = previous?.category;
  const detectedCategory = category;

  return {
    ...previous,
    // Only set category if not already set, OR if user explicitly selected a different department
    category: existingCategory ?? detectedCategory ?? undefined,
    // The draft only ever carries a message that passes the 10–500 rule.
    message: previousMessageCheck.ok ? previousMessageCheck.message : candidateCheck?.ok ? candidateCheck.message : undefined,
    senderName: previous?.senderName ?? name,
    company: previous?.company ?? company,
    replyEmail: previous?.replyEmail ?? extractedEmail,
    language: previous?.language ?? language,
    awaitingConfirmation: false,
  };
}

export function missingContactFields(draft: UsyContactDraft) {
  const missing: Array<"category" | "message" | "senderName" | "replyEmail"> = [];
  if (!draft.category) missing.push("category");
  if (!validateContactMessage(draft.message).ok) missing.push("message");
  if (!draft.senderName || draft.senderName.trim().length < 2) missing.push("senderName");
  if (!draft.replyEmail || !emailPattern.test(draft.replyEmail)) missing.push("replyEmail");
  return missing;
}

export function buildContactSummary(draft: Required<Pick<UsyContactDraft, "category" | "message" | "senderName" | "replyEmail" | "language">> & UsyContactDraft) {
  const department = usyProductFacts.contactDepartments[draft.category];
  if (draft.language === "german") {
    return [
      "Bitte bestätige diese Kontaktanfrage, bevor ich sie sende:",
      "",
      `Abteilung: ${department}`,
      `Name: ${draft.senderName}`,
      draft.company ? `Unternehmen: ${draft.company}` : null,
      `Antwort-E-Mail: ${draft.replyEmail}`,
      `Sprache: ${draft.language}`,
      `Nachricht: ${draft.message}`,
      "",
      "Antworte mit \"senden\" oder \"bestätigen\", um sie zu senden, oder mit \"abbrechen\", um abzubrechen.",
    ].filter(Boolean).join("\n");
  }
  if (draft.language === "dutch") {
    return [
      "Bevestig deze contactaanvraag voordat ik die verstuur:",
      "",
      `Afdeling: ${department}`,
      `Naam: ${draft.senderName}`,
      draft.company ? `Bedrijf: ${draft.company}` : null,
      `Antwoord-e-mail: ${draft.replyEmail}`,
      `Taal: ${draft.language}`,
      `Bericht: ${draft.message}`,
      "",
      "Antwoord met \"versturen\" of \"bevestigen\" om te versturen, of \"annuleren\" om te stoppen.",
    ].filter(Boolean).join("\n");
  }
  if (draft.language === "spanish") {
    return [
      "Confirma esta solicitud de contacto antes de enviarla:",
      "",
      `Departamento: ${department}`,
      `Nombre: ${draft.senderName}`,
      draft.company ? `Empresa: ${draft.company}` : null,
      `Email de respuesta: ${draft.replyEmail}`,
      `Idioma: ${draft.language}`,
      `Mensaje: ${draft.message}`,
      "",
      "Responde con \"enviar\" o \"confirmar\" para enviarla, o \"cancelar\" para cancelarla.",
    ].filter(Boolean).join("\n");
  }
  if (draft.language === "hungarian") {
    return [
      "Kérlek, erősítsd meg ezt a kapcsolatfelvételi kérést, mielőtt elküldöm:",
      "",
      `Részleg: ${department}`,
      `Név: ${draft.senderName}`,
      draft.company ? `Cég: ${draft.company}` : null,
      `Válasz e-mail: ${draft.replyEmail}`,
      `Nyelv: ${draft.language}`,
      `Üzenet: ${draft.message}`,
      "",
      "Írd azt, hogy \"küld\" vagy \"megerősítem\" a küldéshez, vagy \"mégse\" a megszakításhoz.",
    ].filter(Boolean).join("\n");
  }
  if (draft.language === "romanian") {
    return [
      "Confirmă această solicitare de contact înainte să o trimit:",
      "",
      `Departament: ${department}`,
      `Nume: ${draft.senderName}`,
      draft.company ? `Companie: ${draft.company}` : null,
      `Email pentru răspuns: ${draft.replyEmail}`,
      `Limbă: ${draft.language}`,
      `Mesaj: ${draft.message}`,
      "",
      "Răspunde cu \"trimite\" sau \"confirmă\" ca să o trimit, ori \"oprește\" ca să oprești.",
    ].filter(Boolean).join("\n");
  }
  return [
    "Please confirm before I send this contact request:",
    "",
    `Department: ${department}`,
    `Name: ${draft.senderName}`,
    draft.company ? `Company: ${draft.company}` : null,
    `Reply email: ${draft.replyEmail}`,
    `Language: ${draft.language}`,
    `Message: ${draft.message}`,
    "",
    "Reply with \"send\" or \"confirm\" to submit it, or \"cancel\" to stop.",
  ].filter(Boolean).join("\n");
}

export function buildContactDepartmentPrompt(language: SupportedUsyLanguage) {
  if (language === "german") {
    return "Welches Team möchtest du kontaktieren? Wähle Sales, Technical Support, Billing, Management oder Executive Management.";
  }
  if (language === "dutch") {
    return "Welk team wil je contacteren? Kies Sales, Technical Support, Billing, Management of Executive Management.";
  }
  if (language === "spanish") {
    return "¿Con qué equipo quieres contactar? Elige Sales, Technical Support, Billing, Management o Executive Management.";
  }
  if (language === "hungarian") {
    return "Melyik csapattal szeretnél kapcsolatba lépni? Válassz a Sales, Technical Support, Billing, Management vagy Executive Management közül.";
  }
  if (language === "romanian") {
    return "Cu ce echipă vrei să iei legătura? Alege Sales, Technical Support, Billing, Management sau Executive Management.";
  }
  return "Which team would you like to contact? Pick Sales, Technical Support, Billing, Management, or Executive Management.";
}

export function buildContactMessagePrompt(language: SupportedUsyLanguage) {
  if (language === "german") return "Bitte beschreibe dein Anliegen.";
  if (language === "dutch") return "Beschrijf alstublieft je verzoek.";
  if (language === "spanish") return "Por favor, describe tu solicitud.";
  if (language === "hungarian") return "Kérlek, írd le a kérésedet.";
  if (language === "romanian") return "Te rugăm să descrii cererea ta.";
  return "Please describe your request.";
}

export function buildContactMessageProblemAnswer(problem: UsyContactMessageProblem, language: SupportedUsyLanguage) {
  if (problem === "too_long") {
    if (language === "german") return "Dein Anliegen ist zu lang. Bitte fasse es in maximal 500 Zeichen zusammen.";
    if (language === "dutch") return "Je verzoek is te lang. Houd het alstublieft bij maximaal 500 tekens.";
    if (language === "spanish") return "Tu solicitud es demasiado larga. Por favor, mantenla en 500 caracteres como máximo.";
    if (language === "hungarian") return "A kérésed túl hosszú. Kérlek, legfeljebb 500 karakterben írd le.";
    if (language === "romanian") return "Cererea ta este prea lungă. Te rugăm să o limitezi la maximum 500 de caractere.";
    return "Your message is too long. Please keep it to 500 characters or fewer.";
  }
  if (problem === "too_short") {
    if (language === "german") return "Dein Anliegen ist etwas kurz. Bitte beschreibe dein Anliegen mit mindestens 10 Zeichen.";
    if (language === "dutch") return "Je verzoek is iets te kort. Beschrijf je verzoek alstublieft met minimaal 10 tekens.";
    if (language === "spanish") return "Tu solicitud es demasiado corta. Por favor, describe tu solicitud con al menos 10 caracteres.";
    if (language === "hungarian") return "A kérésed kicsit rövid. Kérlek, írd le a kérésedet legalább 10 karakterben.";
    if (language === "romanian") return "Cererea ta este puțin prea scurtă. Te rugăm să descrii cererea cu cel puțin 10 caractere.";
    return "Your message is a bit short. Please describe your request with at least 10 characters.";
  }
  return buildContactMessagePrompt(language);
}

export function buildContactDetailsPrompt(language: SupportedUsyLanguage) {
  if (language === "german") {
    return "Danke. Bitte gib deine Kontaktdaten an, damit das Team antworten kann. Sende deinen Namen und deine Antwort-E-Mail. Unternehmen ist optional.";
  }
  if (language === "dutch") {
    return "Bedankt. Geef je contactgegevens door zodat het team kan reageren. Stuur je naam en je antwoord-e-mail. Bedrijf is optioneel.";
  }
  if (language === "spanish") {
    return "Gracias. Indica tus datos de contacto para que el equipo pueda responderte. Envía tu nombre y tu email de respuesta. La empresa es opcional.";
  }
  if (language === "hungarian") {
    return "Köszönöm. Add meg a kapcsolattartási adataidat, hogy a csapat válaszolni tudjon. Küldd el a nevedet és a válasz e-mailedet. A cég opcionális.";
  }
  if (language === "romanian") {
    return "Mulțumesc. Trimite datele tale de contact ca echipa să îți poată răspunde. Trimite numele tău și emailul pentru răspuns. Compania este opțională.";
  }
  return "Thanks. Please provide your contact details so the team can reply. Please send your name and your reply email. Company is optional.";
}

export function buildConfirmedUsyContactPayload(
  payload: UsyContactPayload,
  metadata: { timestamp?: string; userId?: string | null; organizationId?: string | null },
): UsyWebhookPayload {
  return {
    category: payload.category,
    message: payload.message,
    senderName: payload.senderName,
    ...(payload.company?.trim() ? { company: payload.company.trim() } : {}),
    replyEmail: payload.replyEmail,
    language: payload.language,
    timestamp: metadata.timestamp ?? new Date().toISOString(),
    ...(metadata.userId ? { userId: metadata.userId } : {}),
    ...(metadata.organizationId ? { organizationId: metadata.organizationId } : {}),
  };
}

export function getUsyContactWebhookConfig(env: Record<string, string | undefined> = process.env) {
  const webhookUrl = env.USY_CONTACT_N8N_WEBHOOK_URL?.trim();
  const webhookSecret = env.USY_CONTACT_N8N_WEBHOOK_SECRET?.trim();
  return {
    webhookUrl,
    webhookSecret,
    missing: !webhookUrl || !webhookSecret,
  };
}

export function checkUsyContactRateLimit(identifier: string) {
  return checkRateLimit(`usy-contact:${identifier}`, 3, 10 * 60 * 1000);
}

function extractField(message: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = message.match(pattern);
    const value = match?.[1]?.trim();
    if (value) return value.replace(/\s+/g, " ").slice(0, 120);
  }
  return undefined;
}

function isOnlyCollectionMessage(message: string) {
  const normalized = normalizeUsyText(message);
  // A bare department label or a contact-intent phrase is a selection step,
  // never the request itself.
  return /^(contact|speak|talk|connect|reach|message|email|call|i need|i want|i would like|i d like|can i|please|bitte kontaktiere|kontakt|kontaktiere|ich mochte|ich will|ich brauche|spreek|ik wil|ik heb een vraag|contactar|hablar|quiero|necesito|me gustaria|beszelni|kapcsolat|szeretnem|szeretnek|vorbesc|contactez|as vrea|as dori|vreau|sales|technical support|it support|support|billing|management|executive management|executive)\b/.test(normalized);
}

function matchesKeyword(normalized: string, keyword: string) {
  const normalizedKeyword = normalizeUsyText(keyword);
  if (!normalizedKeyword) return false;
  if (normalizedKeyword.includes(" ")) return normalized.includes(normalizedKeyword);
  return new RegExp(`\\b${escapeRegExp(normalizedKeyword)}\\b`).test(normalized);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
