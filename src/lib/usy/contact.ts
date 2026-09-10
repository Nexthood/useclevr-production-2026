import { checkRateLimit } from "@/lib/utils/rate-limiter";
import { normalizeUsyText } from "@/lib/usy/language";
import { usyContactCategories, usyProductFacts } from "@/lib/usy/knowledge-base";
import type { SupportedUsyLanguage, UsyContactCategory, UsyContactDraft } from "@/lib/usy/types";
import { z } from "zod";

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export const usyContactPayloadSchema = z.object({
  category: z.enum(usyContactCategories),
  message: z.string().trim().min(5, "Message is required.").max(2000, "Message is too long."),
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
  const usableMessage =
    explicitMessage ||
    (trimmed.length >= 20 && !isOnlyCollectionMessage(trimmed) ? trimmed : undefined);

  return {
    ...previous,
    category: previous?.category ?? category ?? undefined,
    message: previous?.message ?? usableMessage,
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
  if (!draft.message || draft.message.trim().length < 5) missing.push("message");
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

export function buildMissingContactFieldsAnswer(draft: UsyContactDraft) {
  const missing = missingContactFields(draft);
  const labelsByLanguage: Record<SupportedUsyLanguage, Record<(typeof missing)[number], string>> = {
    english: {
      category: "department: Sales, Technical Support / IT, Billing, Management, or Executive Management",
      message: "your request",
      senderName: "your name",
      replyEmail: "your reply email",
    },
    german: {
      category: "Abteilung: Sales, Technical Support / IT, Billing, Management oder Executive Management",
      message: "dein Anliegen",
      senderName: "deinen Namen",
      replyEmail: "deine Antwort-E-Mail",
    },
    dutch: {
      category: "afdeling: Sales, Technical Support / IT, Billing, Management of Executive Management",
      message: "je verzoek",
      senderName: "je naam",
      replyEmail: "je antwoord-e-mail",
    },
    spanish: {
      category: "departamento: Sales, Technical Support / IT, Billing, Management o Executive Management",
      message: "tu solicitud",
      senderName: "tu nombre",
      replyEmail: "tu email de respuesta",
    },
    hungarian: {
      category: "részleg: Sales, Technical Support / IT, Billing, Management vagy Executive Management",
      message: "a kérésed",
      senderName: "a neved",
      replyEmail: "a válasz e-mailed",
    },
    romanian: {
      category: "departament: Sales, Technical Support / IT, Billing, Management sau Executive Management",
      message: "cererea ta",
      senderName: "numele tău",
      replyEmail: "emailul pentru răspuns",
    },
  };

  const labels = labelsByLanguage[draft.language ?? "english"];
  const requestedFields = missing.map((field) => labels[field]).join(", ");
  if (draft.language === "german") return `Ich kann diese Kontaktanfrage vorbereiten. Bitte sende ${requestedFields}. Unternehmen ist optional.`;
  if (draft.language === "dutch") return `Ik kan deze contactaanvraag voorbereiden. Stuur ${requestedFields}. Bedrijf is optioneel.`;
  if (draft.language === "spanish") return `Puedo preparar esa solicitud de contacto. Envía ${requestedFields}. La empresa es opcional.`;
  if (draft.language === "hungarian") return `Elő tudom készíteni a kapcsolatfelvételi kérést. Küldd el ezt: ${requestedFields}. A cég opcionális.`;
  if (draft.language === "romanian") return `Pot pregăti această solicitare de contact. Trimite ${requestedFields}. Compania este opțională.`;
  return `I can prepare that contact request. Please send ${requestedFields}. Company is optional.`;
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
  return /^(contact|speak|talk|connect|reach|message|email|call|i need|i want|can i|please|bitte kontaktiere|kontakt|kontaktiere|spreek|contactar|hablar|beszelni|kapcsolat|vorbesc|contactez)\b/.test(normalized);
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
