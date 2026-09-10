import { buildUploadCreditLimitCopy, buildUploadCreditLimitMessage } from "@/lib/billing/upload-credit-messaging";
import {
  getPlanSummary,
  supportedUsyLanguageLabel,
  usyProductFacts,
} from "@/lib/usy/knowledge-base";
import {
  buildContactSummary,
  buildMissingContactFieldsAnswer,
  isCancellation,
  isConfirmation,
  isContactRequest,
  mergeContactDraft,
  missingContactFields,
} from "@/lib/usy/contact";
import { detectUsyLanguage, normalizeUsyText } from "@/lib/usy/language";
import type { SupportedUsyLanguage, UsyChatResponse, UsyContactDraft, UsyContext, UsyIntent, UsyRole } from "@/lib/usy/types";

type ProductIntentId =
  | "languages"
  | "capabilities"
  | "file-formats"
  | "uploads"
  | "upload-trouble"
  | "datasets"
  | "dashboard"
  | "credits"
  | "plans"
  | "billing"
  | "reports"
  | "retail"
  | "accountancy"
  | "governance"
  | "integrations"
  | "account"
  | "support";

type ProductIntentRule = {
  id: ProductIntentId;
  keywords: string[];
  roles?: UsyRole[];
  minScore?: number;
  answer: (context: UsyContext) => string;
  followUps: string[];
};

const fallbackFollowUps = ["Upload my first dataset", "Explain my dashboard", "How do AI credits work?", "Contact support"];
const pricingFollowUps = ["Compare Free vs Pro", "Upgrade to Pro", "Business plan", "Billing & invoices"];
const platformRoles: UsyRole[] = ["admin", "superadmin"];
const intentStopWords = new Set([
  "what",
  "does",
  "useclevr",
  "with",
  "your",
  "you",
  "can",
  "how",
  "who",
  "for",
  "the",
  "and",
  "ist",
  "was",
  "wie",
  "wer",
  "wen",
  "fur",
  "und",
  "kann",
  "ich",
  "wat",
  "hoe",
  "voor",
  "wie",
  "que",
  "como",
  "para",
  "puedo",
  "mit",
  "tud",
  "hogyan",
  "kinek",
  "ce",
  "cum",
  "pot",
  "pentru",
  "cine",
]);

const usyIntentByProductIntent: Record<ProductIntentId, UsyIntent> = {
  languages: "product_information",
  capabilities: "product_information",
  "file-formats": "getting_started",
  uploads: "getting_started",
  "upload-trouble": "technical_support",
  datasets: "getting_started",
  dashboard: "getting_started",
  credits: "account_help",
  plans: "billing",
  billing: "billing",
  reports: "product_information",
  retail: "product_information",
  accountancy: "product_information",
  governance: "security_request",
  integrations: "product_information",
  account: "account_help",
  support: "technical_support",
};

const businessTerms = [
  {
    id: "kpi",
    keywords: ["what is a kpi", "kpi meaning", "key performance indicator", "was ist kpi"],
    answer: "A KPI is a key performance indicator: one important number that shows whether a business activity is healthy, improving, or needs attention.",
  },
  {
    id: "gross-margin",
    keywords: ["gross margin", "bruttomarge", "marge brute", "margen"],
    answer: "Gross margin shows the share of revenue left after direct costs. It helps compare how efficiently products or services generate profit before overhead.",
  },
  {
    id: "cash-flow",
    keywords: ["cash flow", "cashflow", "liquidity", "liquiditeit"],
    answer: "Cash flow is the movement of money in and out of a business. Positive cash flow means more money comes in than goes out during the period.",
  },
  {
    id: "forecast",
    keywords: ["what is a forecast", "forecast meaning", "projection"],
    answer: "A forecast is an estimate of future results based on available data. In UseClevr, forecast questions belong in the AI Assistant when they use uploaded data.",
  },
];

const productIntents: ProductIntentRule[] = [
  {
    id: "languages",
    keywords: ["languages", "which languages", "speak german", "spreek je nederlands", "hablas español", "beszélsz magyarul", "vorbești română"],
    answer: () => `Yes. I can help in ${supportedUsyLanguageLabel}.`,
    followUps: ["What can you do?", "Explain AI credits", "Open AI Assistant", "Which plan do I need?"],
  },
  {
    id: "capabilities",
    keywords: [
      "what can you do",
      "what does useclevr do",
      "what is useclevr",
      "who is it for",
      "who is useclevr for",
      "how can you help",
      "small business",
      "capabilities",
      "was ist useclevr",
      "fur wen",
      "für wen",
      "wer ist useclevr",
      "kleines unternehmen",
      "mit tudsz",
      "mi az useclevr",
      "kinek",
      "wat kun je",
      "wat is useclevr",
      "voor wie",
      "que puedes hacer",
      "que es useclevr",
      "para quien",
      "ce poți face",
      "ce este useclevr",
      "pentru cine",
    ],
    minScore: 4,
    answer: () =>
      `UseClevr is for business owners, retail teams, operators, accountants, and growing teams that need clear decisions from business data uploads. Supported standard upload formats are ${usyProductFacts.uploadFormats.join(", ")}. Upload a file, review the dashboard, use the AI Assistant for dataset-specific questions, and create reports for the next business decision.`,
    followUps: ["Upload my first dataset", "Explain my dashboard", "Which plan do I need?", "Contact support"],
  },
  {
    id: "file-formats",
    keywords: ["file formats", "supported files", "csv", "excel", ".xlsx", ".xls", "dateiformate", "bestanden", "formatos", "fajlformatum", "fișiere"],
    answer: () =>
      `UseClevr supports ${usyProductFacts.uploadFormats.join(", ")} uploads for standard datasets. Accountancy workflows also include specialized upload types shown inside the Accountancy area.`,
    followUps: ["Prepare my CSV", "Upload limit", "Accountancy uploads", "Troubleshoot upload"],
  },
  {
    id: "uploads",
    keywords: [
      "upload",
      "first dataset",
      "import",
      "dataset type",
      "upload mode",
      "start analysis",
      "sales analysis",
      "revenue analysis",
      "hochladen",
      "verkaufsanalyse",
      "umsatzanalyse",
      "analyse starten",
      "uploaden",
      "verkoopanalyse",
      "omzetanalyse",
      "subir",
      "analisis de ventas",
      "análisis de ventas",
      "feltöltés",
      "ertekesitesi elemzes",
      "értékesítési elemzés",
      "ertekesitesi elemzest",
      "értékesítési elemzést",
      "încărcare",
      "analiza vanzarilor",
      "analiza vânzărilor",
    ],
    answer: () =>
      `Open Upload and add a supported file (${usyProductFacts.uploadFormats.join(", ")}) that contains the sales, revenue, margin, inventory, or accounting data you want to review. UseClevr accepts these dataset types: ${usyProductFacts.uploadDatasetTypes.join(", ")}. After processing, open the dashboard and use the AI Assistant for dataset-specific questions.`,
    followUps: ["File formats", "Why is my upload blocked?", "Open datasets", "Analyze my dataset"],
  },
  {
    id: "upload-trouble",
    keywords: ["upload failed", "upload blocked", "upload limit", "can't upload", "cannot upload", "row limit", "file too large", "why is my upload blocked"],
    answer: (context) => {
      if (context.usage?.limitReached) return buildUploadLimitAnswer(context);
      return `Check that the file uses a supported format (${usyProductFacts.uploadFormats.join(", ")}), has clear headers, is not a temporary spreadsheet lock file, and stays within your plan's file, row, dataset, and credit limits. The upload screen shows the exact failure stage when a file cannot be processed.`;
    },
    followUps: ["File formats", "How do AI credits work?", "Which plan do I need?", "Contact support"],
  },
  {
    id: "datasets",
    keywords: ["datasets", "dataset library", "delete dataset", "open dataset", "datensatz", "gegevensset", "conjunto de datos", "adatkeszlet", "set de date"],
    answer: () =>
      "Datasets are the uploaded files UseClevr uses for dashboards, reports, and AI Assistant context. Open Datasets to review uploaded files, open the dashboard for a dataset, or delete files you no longer need.",
    followUps: ["Open Dashboard", "Generate a report", "Upload another file", "Ask AI Assistant"],
  },
  {
    id: "dashboard",
    keywords: ["dashboard", "home", "business health", "kpi", "score"],
    answer: () =>
      "The dashboard summarizes uploaded-data KPIs, business health, risks, opportunities, recommendations, recent activity, and report actions. Use the AI Assistant when you want analysis of a specific uploaded dataset.",
    followUps: ["Explain KPIs", "Ask AI Assistant", "Generate a report", "Upload data"],
  },
  {
    id: "credits",
    keywords: ["credit", "credits", "ai credits", "upload credits", "kredit", "credite"],
    answer: (context) => buildCreditsAnswer(context),
    followUps: ["Upload limit", "Upgrade to Pro", "View billing", "Compare plans"],
  },
  {
    id: "plans",
    keywords: [
      "plans",
      "pricing",
      "price",
      "subscription",
      "which plan",
      "free vs pro",
      "business vs pro",
      "upgrade",
      "billing",
      "cost",
      "costs",
      "useclevr pro",
      "pro per month",
      "pro monthly",
      "kostet",
      "preis",
      "pro monat",
      "was kostet",
    ],
    answer: () => {
      const plans = getPlanSummary();
      return `Free includes ${plans.free.monthlyCredits} AI credits and up to ${plans.free.maxDatasets} datasets. Pro launch pricing is ${plans.pro.priceText} with ${plans.pro.monthlyCredits} AI credits and up to ${plans.pro.maxDatasets} datasets. Business is ${plans.business.priceText} with ${plans.business.monthlyCredits} AI credits, up to ${plans.business.maxDatasets} datasets, larger uploads, Accounting AI, document processing, and dedicated support.`;
    },
    followUps: pricingFollowUps,
  },
  {
    id: "billing",
    keywords: ["billing", "invoice", "invoices", "payment", "stripe", "receipt", "receipts", "factuur", "factura", "rechnung", "számla", "abonament"],
    answer: () =>
      "Billing, subscriptions, payment details, checkout, invoices, and account plan actions are managed through the secure billing and account settings areas. Usy can explain where to go, but payment changes stay inside the existing secure flow.",
    followUps: pricingFollowUps,
  },
  {
    id: "reports",
    keywords: ["report", "reports", "download", "pdf", "excel export", "export", "bericht", "rapport", "informe", "riport"],
    answer: () =>
      "Reports turn completed analysis into shareable management summaries. Use reports for executive review, accountant handoff, investor conversations, internal planning, and PDF or Excel downloads when those exports are available.",
    followUps: ["Generate a report", "Download reports", "Open dashboard", "Ask AI Assistant"],
  },
  {
    id: "retail",
    keywords: ["retail", "retailer", "small retailer", "shop owner", "inventory", "stock", "sku", "pos", "square", "handler", "händler", "einzelhandel", "voorraad", "winkelier", "inventario", "minorista", "készlet", "kereskedo", "kereskedő", "stoc", "retailer mic"],
    answer: () =>
      `Retail teams use UseClevr to turn sales and inventory exports into margin, revenue, stock-risk, dead-stock, and product-performance guidance. Upload supported exports (${usyProductFacts.uploadFormats.join(", ")}) first, then review the Retail dashboard or ask the AI Assistant about the selected dataset.`,
    followUps: ["Retail uploads", "Retail integrations", "Low stock", "Ask AI Assistant"],
  },
  {
    id: "accountancy",
    keywords: ["accountancy", "accounting", "bookkeeping", "invoice processing", "receipt processing", "vat", "tax", "prebookkeeping"],
    answer: () =>
      "Accountancy supports bookkeeping-oriented uploads, invoice and receipt processing, VAT or sales-tax review, transaction categorization, review queues, and export-ready bookkeeping packages in the Accountancy area.",
    followUps: ["Accountancy uploads", "Review transactions", "Export bookkeeping", "Business Profile"],
  },
  {
    id: "governance",
    keywords: ["ai governance", "ai traces", "ai benchmarking", "ai cost optimizer", "human control", "audit"],
    answer: (context) =>
      platformRoles.includes(context.role)
        ? "AI Governance, AI Traces, AI Benchmarking, and AI Cost Optimizer help admins review provider health, model metadata, trace history, feedback, cost signals, retention, and human oversight. Use the matching admin or governance page to inspect current state."
        : "AI Governance tools explain AI transparency, provider health, human oversight, and audit readiness where your role has access. Admin-only trace, benchmarking, and cost views stay restricted.",
    followUps: ["Open AI Governance", "AI traces", "AI benchmarking", "Provider status"],
  },
  {
    id: "integrations",
    keywords: ["integrations", "connect", "square", "snowflake", "warehouse", "local ai", "byok", "ai provider"],
    answer: () =>
      "UseClevr currently supports file uploads, Retail point-of-sale integration flows where enabled, local AI status and install helpers, and BYOK AI provider settings. Usy does not invent connector availability; check the relevant integration page for active options.",
    followUps: ["Retail integrations", "AI providers", "Local AI", "Contact support"],
  },
  {
    id: "account",
    keywords: ["account", "settings", "profile", "email address", "login", "sign in", "organization", "workspace"],
    answer: () =>
      "Account settings manage your profile, sign-in details, organization context, plan visibility, billing entry points, and workspace preferences where your role has access. Security-sensitive account changes stay inside the secure settings flow.",
    followUps: ["Open settings", "Billing help", "Contact support", "AI credits"],
  },
  {
    id: "support",
    keywords: ["support", "ticket", "help", "troubleshoot", "human", "technical support"],
    answer: () =>
      "I can guide you here, point you to the right UseClevr area, or prepare a confirmed contact request for Sales, Technical Support / IT, Billing, Management, or Executive Management.",
    followUps: ["Contact support", "Troubleshoot upload", "Billing help", "Talk to Sales"],
  },
];

export function buildUsyReply(input: {
  question: string;
  context: UsyContext;
  contactDraft?: UsyContactDraft | null;
}): UsyChatResponse {
  const question = input.question.trim();
  const context = input.context;
  const language = detectUsyLanguage(question);
  const normalized = normalizeUsyText(question);

  if (input.contactDraft?.awaitingConfirmation) {
    const contactLanguage = input.contactDraft.language ?? language;
    if (isCancellation(question)) {
      return {
        answer: localizedCommon("contactCancelled", contactLanguage),
        source: "knowledge",
        followUps: localizeFollowUps(fallbackFollowUps, contactLanguage),
        language: contactLanguage,
        contactDraft: null,
        action: "clear_contact",
        intent: "contact_request",
      };
    }

    if (isConfirmation(question)) {
      return {
        answer: localizedCommon("contactSubmitting", contactLanguage),
        source: "knowledge",
        followUps: [],
        language: contactLanguage,
        contactDraft: input.contactDraft,
        action: "submit_contact",
        intent: "contact_request",
      };
    }
  }

  if (asksForRestrictedInformation(normalized)) {
    return knowledgeAnswer(localizedCommon("restricted", language), ["What can Usy help with?", "Contact support", "Open settings", "Use AI Assistant"], "security_request", language);
  }

  if (!platformRoles.includes(context.role) && asksForAdminOnlyArea(normalized)) {
    return knowledgeAnswer(localizedCommon("adminOnly", language), fallbackFollowUps, "security_request", language);
  }

  if (asksForProMonthlyPrice(normalized)) {
    return knowledgeAnswer(buildProMonthlyPriceAnswer(language), pricingFollowUps, "billing", language);
  }

  if (input.contactDraft || isContactRequest(question)) {
    const draft = mergeContactDraft(input.contactDraft, question, input.contactDraft?.language ?? language);
    const missing = missingContactFields(draft);
    if (missing.length > 0) {
      return {
        answer: buildMissingContactFieldsAnswer(draft),
        source: "knowledge",
        followUps: localizeFollowUps(["Sales", "Technical Support", "Billing", "Management", "Executive Management"], draft.language ?? language),
        language: draft.language ?? language,
        contactDraft: draft,
        intent: "contact_request",
      };
    }

    const completeDraft = { ...draft, awaitingConfirmation: true } as UsyContactDraft & {
      category: NonNullable<UsyContactDraft["category"]>;
      message: string;
      senderName: string;
      replyEmail: string;
      language: NonNullable<UsyContactDraft["language"]>;
    };
    return {
      answer: buildContactSummary(completeDraft),
      source: "knowledge",
      followUps: localizeFollowUps(["Confirm", "Cancel"], completeDraft.language),
      language: completeDraft.language,
      contactDraft: completeDraft,
      intent: "contact_request",
    };
  }

  if (requiresAiAssistant(normalized)) {
    return knowledgeAnswer(localizedCommon("aiAssistant", language), ["Open AI Assistant", "Choose a dataset", "Generate a report", "Upload data"], "ai_analysis_request", language);
  }

  const intent = detectProductIntent(normalized, context.role);
  if (intent) {
    return knowledgeAnswer(
      `${localizedIntentAnswer(intent.id, context, language) ?? intent.answer(context)}\n\n${localizedCommon("nextStep", language)} ${nextStepForIntent(intent.id, context, language)}`,
      intent.followUps,
      usyIntentByProductIntent[intent.id],
      language,
    );
  }

  const term = businessTerms.find((entry) => entry.keywords.some((keyword) => normalized.includes(normalizeUsyText(keyword))));
  if (term) {
    return knowledgeAnswer(`${localizedTermAnswer(term.id, language) ?? term.answer} ${localizedCommon("termSuffix", language)}`, ["Ask AI Assistant", "Upload data", "Explain dashboard", "Generate report"], "product_information", language);
  }

  return knowledgeAnswer(localizedCommon("unknown", language), fallbackFollowUps, "unknown", language);
}

export function roleFromAudience(audience: UsyContext["audience"], sessionRole?: string | null): UsyRole {
  if (sessionRole === "superadmin" || audience === "superadmin") return "superadmin";
  if (sessionRole === "admin") return "admin";
  if (audience === "public") return "public";
  return "user";
}

function detectProductIntent(normalized: string, role: UsyRole) {
  const tokens = new Set(normalized.split(" ").filter((token) => token.length > 1));
  return productIntents
    .map((intent) => ({
      intent,
      score: intent.roles && !intent.roles.includes(role) ? 0 : scoreIntent(normalized, tokens, intent),
    }))
    .filter(({ intent, score }) => score >= (intent.minScore ?? 2))
    .sort((a, b) => b.score - a.score)[0]?.intent ?? null;
}

function scoreIntent(normalized: string, tokens: Set<string>, intent: ProductIntentRule) {
  return intent.keywords.reduce((score, keyword) => {
    const normalizedKeyword = normalizeUsyText(keyword);
    if (!normalizedKeyword) return score;
    if (normalized === normalizedKeyword) return score + 8;
    if (normalized.includes(normalizedKeyword)) return score + (normalizedKeyword.includes(" ") ? 5 : 3);
    return score + normalizedKeyword
      .split(" ")
      .filter((part) => part.length > 2 && !intentStopWords.has(part) && tokens.has(part))
      .length;
  }, 0);
}

function requiresAiAssistant(normalized: string) {
  const analysisSignals = [
    "analyse my",
    "analyze my",
    "analyze this",
    "my sales",
    "my revenue",
    "my uploaded",
    "uploaded file",
    "why is my revenue",
    "why is revenue",
    "revenue down",
    "sales down",
    "why did revenue decline",
    "why did sales decline",
    "create a forecast",
    "can i create a forecast",
    "forecast my",
    "worst margin",
    "which products have the lowest margin",
    "lowest margin",
    "lowest-margin products",
    "find risks",
    "find trends",
    "business performance",
    "kpi for my",
    "warum ist mein umsatz",
    "umsatz gesunken",
    "umsatz gefallen",
    "warum sind meine verkaufe",
    "warum sind meine verkäufe",
    "welche produkte haben die schlechteste marge",
    "schlechteste marge",
    "niedrigste marge",
    "forecast erstellen",
    "prognose erstellen",
    "kan ik een forecast",
    "waarom is mijn omzet",
    "omzet gedaald",
    "slechtste marge",
    "puedo crear un forecast",
    "puedo hacer un forecast",
    "por que bajaron mis ingresos",
    "por qué bajaron mis ingresos",
    "productos tienen el peor margen",
    "tudok forecastot",
    "tudok elorejelzest",
    "tudok előrejelzést",
    "miert csokkent a bevetelem",
    "miért csökkent a bevételem",
    "legrosszabb arres",
    "legrosszabb árrés",
    "pot crea un forecast",
    "pot face o prognoza",
    "pot face o prognoză",
    "de ce a scazut venitul",
    "de ce a scăzut venitul",
    "cea mai slaba marja",
    "cea mai slabă marjă",
  ];
  return analysisSignals.some((signal) => normalized.includes(signal));
}

function asksForRestrictedInformation(normalized: string) {
  const restrictedSignals = [
    "system prompt",
    "system instructions",
    "developer prompt",
    "api key",
    "api keys",
    "secret",
    "webhook",
    "token",
    "password",
    "internal architecture",
    "security details",
    "customer data",
    "another user",
    "another customer",
    "other customer's data",
    "other customers data",
    "database credentials",
    "system anweisung",
    "systemanweisung",
    "api schlussel",
    "api-schlussel",
    "geheimnis",
    "interne architektur",
    "andere kunden",
    "daten anderer kunden",
    "andere kunden hochgeladen",
    "andere useclevr kunden",
    "welche daten haben andere",
    "systeeminstructies",
    "systeemprompt",
    "api sleutel",
    "geheim",
    "interne architectuur",
    "andere klanten",
    "data van andere klanten",
    "instrucciones del sistema",
    "prompt del sistema",
    "clave api",
    "secreto",
    "arquitectura interna",
    "otros clientes",
    "datos de otros clientes",
    "rendszerutasitas",
    "rendszer prompt",
    "api kulcs",
    "titok",
    "belso architektura",
    "mas ugyfel",
    "mas ugyfelek",
    "mas ugyfel adata",
    "instructiuni de sistem",
    "prompt de sistem",
    "cheie api",
    "arhitectura interna",
    "alti clienti",
    "datele altui client",
  ];
  return restrictedSignals.some((signal) => normalized.includes(signal));
}

function asksForAdminOnlyArea(normalized: string) {
  return ["admin customer", "all customers", "ai traces", "ai benchmarking", "ai cost optimizer", "mcp tokens", "superadmin"].some((signal) =>
    normalized.includes(signal),
  );
}

function asksForProMonthlyPrice(normalized: string) {
  const mentionsPro = /\bpro\b/.test(normalized);
  const mentionsPrice = /\b(price|cost|costs|pricing|kostet|preis|monat|monthly|month)\b/.test(normalized);
  return mentionsPro && mentionsPrice;
}

function buildProMonthlyPriceAnswer(language: SupportedUsyLanguage) {
  const proPrice = getPlanSummary().pro.priceText;
  if (language === "german") return `UseClevr Pro kostet ${proPrice.replace("/month", "/Monat")}.`;
  if (language === "dutch") return `UseClevr Pro kost ${proPrice.replace("/month", "/maand")}.`;
  if (language === "spanish") return `UseClevr Pro cuesta ${proPrice.replace("/month", "/mes")}.`;
  if (language === "hungarian") return `A UseClevr Pro ára ${proPrice.replace("/month", "/hó")}.`;
  if (language === "romanian") return `UseClevr Pro costă ${proPrice.replace("/month", "/lună")}.`;
  return `UseClevr Pro costs ${proPrice}.`;
}

function buildCreditsAnswer(context: UsyContext, language: SupportedUsyLanguage = "english") {
  const usageText =
    context.usage?.unlimited
      ? context.usage.unlimitedLabel || "unlimited usage"
      : typeof context.usage?.analysisCount === "number" && typeof context.usage?.total === "number"
        ? `${context.usage.analysisCount}/${context.usage.total}`
        : null;
  if (language === "german") {
    return [
      "AI-Credits steuern enthaltene AI-Aktionen wie Uploads, Analysen, Assistant-Fragen und Reports im aktiven Plan.",
      usageText ? `Aktuell sichtbare Nutzung: ${usageText}.` : null,
      "Erfolgreiche Uploads verbrauchen Upload-Credits. Fehlgeschlagene Uploads verbrauchen keine Upload-Credits. Gelöschte Datasets stellen verbrauchte Credits nicht wieder her.",
    ].filter(Boolean).join(" ");
  }
  if (language === "dutch") {
    return [
      "AI credits sturen inbegrepen AI-acties zoals uploads, analyses, Assistant-vragen en rapporten binnen het actieve plan.",
      usageText ? `Zichtbaar gebruik nu: ${usageText}.` : null,
      "Succesvolle uploads gebruiken uploadcredits. Mislukte uploads gebruiken geen uploadcredits. Verwijderde datasets herstellen verbruikte credits niet.",
    ].filter(Boolean).join(" ");
  }
  if (language === "spanish") {
    return [
      "Los créditos AI controlan acciones incluidas como cargas, análisis, preguntas al Assistant e informes según el plan activo.",
      usageText ? `Uso visible actual: ${usageText}.` : null,
      "Las cargas correctas consumen créditos de upload. Las cargas fallidas no consumen créditos. Eliminar datasets no restaura créditos consumidos.",
    ].filter(Boolean).join(" ");
  }
  if (language === "hungarian") {
    return [
      "Az AI kreditek az aktív csomagban elérhető AI műveleteket kezelik, például uploadot, elemzést, Assistant-kérdést és riportot.",
      usageText ? `Jelenleg látható használat: ${usageText}.` : null,
      "A sikeres uploadok upload kreditet fogyasztanak. A sikertelen uploadok nem fogyasztanak kreditet. Dataset törlése nem állítja vissza az elhasznált kreditet.",
    ].filter(Boolean).join(" ");
  }
  if (language === "romanian") {
    return [
      "Creditele AI controlează acțiuni incluse precum uploaduri, analize, întrebări către Assistant și rapoarte în planul activ.",
      usageText ? `Utilizare vizibilă curentă: ${usageText}.` : null,
      "Uploadurile reușite consumă credite de upload. Uploadurile eșuate nu consumă credite. Ștergerea seturilor de date nu restaurează creditele consumate.",
    ].filter(Boolean).join(" ");
  }
  return [
    "AI credits control included AI-powered actions such as uploads, analysis, assistant requests, and reports according to the active plan.",
    usageText ? `Current visible usage: ${usageText}.` : null,
    "Successful uploads consume upload credits. Failed uploads do not consume upload credits. Deleting datasets does not restore consumed upload credits.",
  ].filter(Boolean).join(" ");
}

function buildUploadLimitAnswer(context: UsyContext, language: SupportedUsyLanguage = "english") {
  const limit = context.usage?.total ?? 2;
  const used = context.usage?.analysisCount ?? limit;
  if (language === "german") {
    return `Deine Upload-Credits sind aufgebraucht (${used}/${limit}). Öffne Billing Settings, um Pro- und Business-Kapazität zu vergleichen.`;
  }
  if (language === "dutch") {
    return `Je uploadcredits zijn op (${used}/${limit}). Open Billing Settings om Pro- en Business-capaciteit te vergelijken.`;
  }
  if (language === "spanish") {
    return `Tus créditos de upload están agotados (${used}/${limit}). Abre Billing Settings para comparar la capacidad de Pro y Business.`;
  }
  if (language === "hungarian") {
    return `Elfogytak az upload kreditjeid (${used}/${limit}). Nyisd meg a Billing Settings részt a Pro és Business kapacitás összehasonlításához.`;
  }
  if (language === "romanian") {
    return `Creditele tale de upload sunt epuizate (${used}/${limit}). Deschide Billing Settings ca să compari capacitatea Pro și Business.`;
  }
  const creditCopy = buildUploadCreditLimitCopy({ used, limit, remaining: 0 });

  return [
    creditCopy.title,
    "",
    buildUploadCreditLimitMessage(creditCopy.limit),
    "",
    "Open Billing Settings to compare Pro and Business upload capacity.",
  ].join("\n");
}

function nextStepForIntent(intentId: string, context: UsyContext, language: SupportedUsyLanguage) {
  if (language !== "english") {
    if (intentId === "plans" || intentId === "billing") return localizedCommon("nextBilling", language);
    if (intentId === "uploads" || intentId === "file-formats" || intentId === "upload-trouble") return localizedCommon("nextUpload", language);
    if (intentId === "datasets") return localizedCommon("nextDatasets", language);
    if (intentId === "dashboard") return localizedCommon("nextDashboard", language);
    if (intentId === "governance" && platformRoles.includes(context.role)) return localizedCommon("nextGovernance", language);
    if (intentId === "support") return localizedCommon("nextSupport", language);
    return localizedCommon("nextGeneric", language);
  }

  if (intentId === "plans" || intentId === "billing") return "open Billing Settings to review your plan, invoices, and upgrade options.";
  if (intentId === "uploads" || intentId === "file-formats" || intentId === "upload-trouble") return "open Upload and use the file guidance shown there.";
  if (intentId === "datasets") return "open Datasets and select the file you want to inspect.";
  if (intentId === "dashboard") return "open the Dashboard, then use AI Assistant for uploaded-data analysis.";
  if (intentId === "governance" && platformRoles.includes(context.role)) return "open the matching governance or admin page and inspect current records there.";
  if (intentId === "support") return "tell me the department, request, name, and reply email if you want me to prepare a contact request.";
  return "open the matching UseClevr area, and I can help you decide what to check first.";
}

function knowledgeAnswer(answer: string, followUps: string[], intent: UsyIntent, language: SupportedUsyLanguage = "english"): UsyChatResponse {
  return {
    answer,
    source: "knowledge",
    followUps: localizeFollowUps(followUps, language).slice(0, 5),
    language,
    intent,
  };
}

function localizeFollowUps(followUps: string[], language: SupportedUsyLanguage) {
  if (language === "english") return followUps;

  const labels: Record<SupportedUsyLanguage, Record<string, string>> = {
    english: {},
    german: {
      "Analyze my dataset": "Dataset analysieren",
      "Accountancy uploads": "Accountancy-Uploads",
      "AI benchmarking": "AI-Benchmarking",
      "AI credits": "AI-Credits",
      "AI providers": "AI-Provider",
      "AI traces": "AI-Traces",
      "Ask AI Assistant": "AI Assistant fragen",
      "Billing & invoices": "Billing und Rechnungen",
      "Billing help": "Billing-Hilfe",
      "Business plan": "Business-Plan",
      "Choose a dataset": "Dataset auswählen",
      "Compare Free vs Pro": "Free und Pro vergleichen",
      "Contact support": "Support kontaktieren",
      "Explain AI credits": "AI-Credits erklären",
      "Explain KPIs": "KPIs erklären",
      "Explain my dashboard": "Dashboard erklären",
      "File formats": "Dateiformate",
      "Generate a report": "Report erstellen",
      
      "How do AI credits work?": "Wie funktionieren AI-Credits?",
      "Open AI Assistant": "AI Assistant öffnen",
      "Open AI Governance": "AI Governance öffnen",
      "Open Dashboard": "Dashboard öffnen",
      "Open dashboard": "Dashboard öffnen",
      "Open datasets": "Datasets öffnen",
      "Open settings": "Einstellungen öffnen",
      "Prepare my CSV": "CSV vorbereiten",
      "Provider status": "Provider-Status",
      "Retail integrations": "Retail-Integrationen",
      "Retail uploads": "Retail-Uploads",
      "Review transactions": "Transaktionen prüfen",
      "Talk to Sales": "Mit Sales sprechen",
      "Troubleshoot upload": "Upload prüfen",
      "Upload another file": "Weitere Datei hochladen",
      "Upload data": "Daten hochladen",
      "Upload limit": "Upload-Limit",
      "Upload my first dataset": "Erstes Dataset hochladen",
      "Upgrade to Pro": "Auf Pro upgraden",
      "Use AI Assistant": "AI Assistant nutzen",
      "View billing": "Billing öffnen",
      "What can Usy help with?": "Wobei hilft Usy?",
      "What can you do?": "Was kannst du?",
      "Which plan do I need?": "Welchen Plan brauche ich?",
      "Why is my upload blocked?": "Warum ist mein Upload blockiert?",
      "Business Profile": "Business Profile",
      "Compare plans": "Pläne vergleichen",
      "Download reports": "Reports herunterladen",
      "Export bookkeeping": "Bookkeeping exportieren",
      "Local AI": "Local AI",
      "Low stock": "Niedriger Bestand",
      Sales: "Sales",
      "Technical Support": "Technical Support",
      Billing: "Billing",
      Management: "Management",
      "Executive Management": "Executive Management",
      "Try again": "Erneut versuchen",
      Confirm: "Bestätigen",
      Cancel: "Abbrechen",
    },
    dutch: {
      "Analyze my dataset": "Dataset analyseren",
      "Accountancy uploads": "Accountancy-uploads",
      "AI benchmarking": "AI-benchmarking",
      "AI credits": "AI credits",
      "AI providers": "AI-providers",
      "AI traces": "AI-traces",
      "Ask AI Assistant": "AI Assistant vragen",
      "Billing & invoices": "Billing en facturen",
      "Billing help": "Billing-hulp",
      "Business plan": "Business-plan",
      "Business Profile": "Business Profile",
      "Choose a dataset": "Dataset kiezen",
      "Compare Free vs Pro": "Free en Pro vergelijken",
      "Compare plans": "Plannen vergelijken",
      "Contact support": "Support contacteren",
      "Download reports": "Rapporten downloaden",
      "Explain AI credits": "AI credits uitleggen",
      "Explain KPIs": "KPI's uitleggen",
      "Explain my dashboard": "Dashboard uitleggen",
      "Export bookkeeping": "Boekhouding exporteren",
      "File formats": "Bestandsformaten",
      "Generate a report": "Rapport maken",
      
      "How do AI credits work?": "Hoe werken AI credits?",
      "Local AI": "Local AI",
      "Low stock": "Lage voorraad",
      "Open AI Assistant": "AI Assistant openen",
      "Open AI Governance": "AI Governance openen",
      "Open Dashboard": "Dashboard openen",
      "Open dashboard": "Dashboard openen",
      "Open datasets": "Datasets openen",
      "Open settings": "Instellingen openen",
      "Prepare my CSV": "CSV voorbereiden",
      "Provider status": "Providerstatus",
      "Retail integrations": "Retail-integraties",
      "Retail uploads": "Retail-uploads",
      "Review transactions": "Transacties controleren",
      Sales: "Sales",
      "Technical Support": "Technical Support",
      Billing: "Billing",
      Management: "Management",
      "Executive Management": "Executive Management",
      "Talk to Sales": "Met Sales spreken",
      "Troubleshoot upload": "Upload oplossen",
      "Try again": "Opnieuw proberen",
      "Upload another file": "Nog een bestand uploaden",
      "Upload data": "Data uploaden",
      "Upload limit": "Uploadlimiet",
      "Upload my first dataset": "Eerste dataset uploaden",
      "Upgrade to Pro": "Upgraden naar Pro",
      "Use AI Assistant": "AI Assistant gebruiken",
      "View billing": "Billing openen",
      "What can Usy help with?": "Waarmee helpt Usy?",
      "What can you do?": "Wat kun je?",
      "Which plan do I need?": "Welk plan heb ik nodig?",
      "Why is my upload blocked?": "Waarom is mijn upload geblokkeerd?",
      Confirm: "Bevestigen",
      Cancel: "Annuleren",
    },
    spanish: {
      "Analyze my dataset": "Analizar mi dataset",
      "Accountancy uploads": "Cargas de Accountancy",
      "AI benchmarking": "Benchmarking AI",
      "AI credits": "Créditos AI",
      "AI providers": "Proveedores AI",
      "AI traces": "Trazas AI",
      "Ask AI Assistant": "Preguntar a AI Assistant",
      "Billing & invoices": "Billing y facturas",
      "Billing help": "Ayuda de billing",
      "Business plan": "Plan Business",
      "Business Profile": "Business Profile",
      "Choose a dataset": "Elegir dataset",
      "Compare Free vs Pro": "Comparar Free y Pro",
      "Compare plans": "Comparar planes",
      "Contact support": "Contactar soporte",
      "Download reports": "Descargar informes",
      "Explain AI credits": "Explicar créditos AI",
      "Explain KPIs": "Explicar KPI",
      "Explain my dashboard": "Explicar dashboard",
      "Export bookkeeping": "Exportar bookkeeping",
      "File formats": "Formatos de archivo",
      "Generate a report": "Crear informe",
      
      "How do AI credits work?": "Cómo funcionan los créditos AI",
      "Local AI": "Local AI",
      "Low stock": "Stock bajo",
      "Open AI Assistant": "Abrir AI Assistant",
      "Open AI Governance": "Abrir AI Governance",
      "Open Dashboard": "Abrir dashboard",
      "Open dashboard": "Abrir dashboard",
      "Open datasets": "Abrir datasets",
      "Open settings": "Abrir configuración",
      "Prepare my CSV": "Preparar CSV",
      "Provider status": "Estado del proveedor",
      "Retail integrations": "Integraciones Retail",
      "Retail uploads": "Cargas Retail",
      "Review transactions": "Revisar transacciones",
      Sales: "Sales",
      "Technical Support": "Technical Support",
      Billing: "Billing",
      Management: "Management",
      "Executive Management": "Executive Management",
      "Talk to Sales": "Hablar con Sales",
      "Troubleshoot upload": "Revisar upload",
      "Try again": "Intentar de nuevo",
      "Upload another file": "Subir otro archivo",
      "Upload data": "Subir datos",
      "Upload limit": "Límite de upload",
      "Upload my first dataset": "Subir primer dataset",
      "Upgrade to Pro": "Subir a Pro",
      "Use AI Assistant": "Usar AI Assistant",
      "View billing": "Abrir billing",
      "What can Usy help with?": "En qué ayuda Usy",
      "What can you do?": "Qué puedes hacer",
      "Which plan do I need?": "Qué plan necesito",
      "Why is my upload blocked?": "Por qué está bloqueado mi upload",
      Confirm: "Confirmar",
      Cancel: "Cancelar",
    },
    hungarian: {
      "Analyze my dataset": "Dataset elemzése",
      "Accountancy uploads": "Accountancy uploadok",
      "AI benchmarking": "AI benchmarking",
      "AI credits": "AI kreditek",
      "AI providers": "AI providerek",
      "AI traces": "AI trace-ek",
      "Ask AI Assistant": "AI Assistant megkérdezése",
      "Billing & invoices": "Billing és számlák",
      "Billing help": "Billing segítség",
      "Business plan": "Business csomag",
      "Business Profile": "Business Profile",
      "Choose a dataset": "Dataset kiválasztása",
      "Compare Free vs Pro": "Free és Pro összehasonlítása",
      "Compare plans": "Csomagok összehasonlítása",
      "Contact support": "Support kapcsolat",
      "Download reports": "Riportok letöltése",
      "Explain AI credits": "AI kreditek magyarázata",
      "Explain KPIs": "KPI-k magyarázata",
      "Explain my dashboard": "Dashboard magyarázata",
      "Export bookkeeping": "Bookkeeping export",
      "File formats": "Fájlformátumok",
      "Generate a report": "Riport készítése",
      
      "How do AI credits work?": "Hogyan működnek az AI kreditek?",
      "Local AI": "Local AI",
      "Low stock": "Alacsony készlet",
      "Open AI Assistant": "AI Assistant megnyitása",
      "Open AI Governance": "AI Governance megnyitása",
      "Open Dashboard": "Dashboard megnyitása",
      "Open dashboard": "Dashboard megnyitása",
      "Open datasets": "Datasetek megnyitása",
      "Open settings": "Beállítások megnyitása",
      "Prepare my CSV": "CSV előkészítése",
      "Provider status": "Provider státusz",
      "Retail integrations": "Retail integrációk",
      "Retail uploads": "Retail uploadok",
      "Review transactions": "Tranzakciók ellenőrzése",
      Sales: "Sales",
      "Technical Support": "Technical Support",
      Billing: "Billing",
      Management: "Management",
      "Executive Management": "Executive Management",
      "Talk to Sales": "Beszélj Sales-szel",
      "Troubleshoot upload": "Upload hibaelhárítás",
      "Try again": "Próbáld újra",
      "Upload another file": "Másik fájl feltöltése",
      "Upload data": "Adatok feltöltése",
      "Upload limit": "Upload limit",
      "Upload my first dataset": "Első dataset feltöltése",
      "Upgrade to Pro": "Váltás Pro-ra",
      "Use AI Assistant": "AI Assistant használata",
      "View billing": "Billing megnyitása",
      "What can Usy help with?": "Miben segít Usy?",
      "What can you do?": "Mit tudsz?",
      "Which plan do I need?": "Melyik csomag kell?",
      "Why is my upload blocked?": "Miért blokkolt az upload?",
      Confirm: "Megerősítés",
      Cancel: "Megszakítás",
    },
    romanian: {
      "Analyze my dataset": "Analizează setul de date",
      "Accountancy uploads": "Uploaduri Accountancy",
      "AI benchmarking": "Benchmarking AI",
      "AI credits": "Credite AI",
      "AI providers": "Provideri AI",
      "AI traces": "Trace-uri AI",
      "Ask AI Assistant": "Întreabă AI Assistant",
      "Billing & invoices": "Billing și facturi",
      "Billing help": "Ajutor billing",
      "Business plan": "Plan Business",
      "Business Profile": "Business Profile",
      "Choose a dataset": "Alege setul de date",
      "Compare Free vs Pro": "Compară Free și Pro",
      "Compare plans": "Compară planurile",
      "Contact support": "Contactează suportul",
      "Download reports": "Descarcă rapoarte",
      "Explain AI credits": "Explică creditele AI",
      "Explain KPIs": "Explică KPI-urile",
      "Explain my dashboard": "Explică dashboardul",
      "Export bookkeeping": "Exportă bookkeeping",
      "File formats": "Formate de fișiere",
      "Generate a report": "Creează raport",
      
      "How do AI credits work?": "Cum funcționează creditele AI?",
      "Local AI": "Local AI",
      "Low stock": "Stoc redus",
      "Open AI Assistant": "Deschide AI Assistant",
      "Open AI Governance": "Deschide AI Governance",
      "Open Dashboard": "Deschide dashboardul",
      "Open dashboard": "Deschide dashboardul",
      "Open datasets": "Deschide seturile de date",
      "Open settings": "Deschide setările",
      "Prepare my CSV": "Pregătește CSV-ul",
      "Provider status": "Status provider",
      "Retail integrations": "Integrări Retail",
      "Retail uploads": "Uploaduri Retail",
      "Review transactions": "Revizuiește tranzacțiile",
      Sales: "Sales",
      "Technical Support": "Technical Support",
      Billing: "Billing",
      Management: "Management",
      "Executive Management": "Executive Management",
      "Talk to Sales": "Vorbește cu Sales",
      "Troubleshoot upload": "Depanează uploadul",
      "Try again": "Încearcă din nou",
      "Upload another file": "Încarcă alt fișier",
      "Upload data": "Încarcă date",
      "Upload limit": "Limită de upload",
      "Upload my first dataset": "Încarcă primul set de date",
      "Upgrade to Pro": "Upgrade la Pro",
      "Use AI Assistant": "Folosește AI Assistant",
      "View billing": "Deschide billing",
      "What can Usy help with?": "Cu ce ajută Usy?",
      "What can you do?": "Ce poți face?",
      "Which plan do I need?": "Ce plan îmi trebuie?",
      "Why is my upload blocked?": "De ce este blocat uploadul meu?",
      Confirm: "Confirmă",
      Cancel: "Anulează",
    },
  };

  return followUps.map((followUp) => labels[language][followUp] ?? followUp);
}

function localizedIntentAnswer(intentId: string, context: UsyContext, language: SupportedUsyLanguage) {
  if (language === "english") return null;
  const plans = getPlanSummary();
  const uploadFormats = usyProductFacts.uploadFormats.join(", ");
  const uploadTypes = usyProductFacts.uploadDatasetTypes.join(", ");
  const answers: Record<SupportedUsyLanguage, Partial<Record<string, string>>> = {
    english: {},
    german: {
      languages: `Ja. Ich kann auf ${supportedUsyLanguageLabel} helfen.`,
      capabilities: `UseClevr ist für Inhaber, Händler, Operations-Teams, Buchhaltung und wachsende Teams gedacht, die aus Business-Uploads klare Entscheidungen ableiten wollen. Unterstützte Standard-Uploadformate sind ${uploadFormats}. Lade Daten hoch, prüfe das Dashboard und stelle dataset-spezifische Fragen im AI Assistant.`,
      "file-formats": `UseClevr unterstützt ${uploadFormats} für Standard-Datasets. Spezialisierte Accountancy-Uploads siehst du im Accountancy-Bereich.`,
      uploads: `Öffne Upload und füge eine Datei in einem unterstützten Format (${uploadFormats}) mit Verkaufs-, Umsatz-, Margen-, Bestands- oder Buchhaltungsdaten hinzu. UseClevr akzeptiert diese Dataset-Typen: ${uploadTypes}. Danach öffnest du das Dashboard oder fragst den AI Assistant zum ausgewählten Dataset.`,
      "upload-trouble": context.usage?.limitReached ? buildUploadLimitAnswer(context, language) : `Prüfe, ob die Datei ein unterstütztes Format (${uploadFormats}) nutzt, klare Header hat, keine temporäre Tabellenkalkulations-Sperrdatei ist und innerhalb deiner Planlimits liegt.`,
      datasets: "Datasets sind die hochgeladenen Dateien, die UseClevr für Dashboards, Berichte und AI-Assistant-Kontext verwendet.",
      dashboard: "Das Dashboard fasst KPIs, Business Health, Risiken, Chancen, Empfehlungen, Aktivität und Berichtsaktionen zusammen.",
      credits: buildCreditsAnswer(context, language),
      plans: `Free enthält ${plans.free.monthlyCredits} AI-Credits und bis zu ${plans.free.maxDatasets} Datasets. Pro kostet €40/Monat. Business kostet €420/Monat.`,
      billing: "Billing, Abos, Zahlungsdaten, Checkout, Rechnungen und Planaktionen werden in den sicheren Billing- und Account-Einstellungen verwaltet.",
      reports: "Berichte verwandeln abgeschlossene Analysen in teilbare Management-Zusammenfassungen mit PDF- oder Excel-Downloads, wenn diese Exporte verfügbar sind.",
      retail: `UseClevr hilft kleinen Händlern, Verkaufs- und Bestandsdaten in Umsatz-, Margen-, Stock-Risk-, Dead-Stock- und Produktleistungs-Hinweise zu übersetzen. Lade zuerst unterstützte Exporte (${uploadFormats}) hoch und nutze danach Dashboard oder AI Assistant.`,
      accountancy: "Accountancy unterstützt bookkeeping-orientierte Uploads, Rechnungs- und Belegverarbeitung, Steuerprüfung, Kategorisierung, Review-Queues und Exporte.",
      governance: "AI Governance erklärt Transparenz, Provider-Status, menschliche Kontrolle und Audit-Bereitschaft. Admin-Ansichten bleiben rollenbeschränkt.",
      integrations: "UseClevr unterstützt Datei-Uploads, aktivierte Retail-Integrationen, Local-AI-Hilfen und BYOK-AI-Provider-Einstellungen.",
      support: "Ich kann dich hier führen oder eine bestätigte Kontaktanfrage für Sales, Technical Support / IT, Billing, Management oder Executive Management vorbereiten.",
    },
    dutch: {
      languages: `Ja. Ik kan helpen in ${supportedUsyLanguageLabel}.`,
      capabilities: `UseClevr is bedoeld voor ondernemers, retailers, operationele teams, accountants en groeiende teams die duidelijke beslissingen uit bedrijfsuploads willen halen. Ondersteunde standaard uploadformaten zijn ${uploadFormats}. Upload data, bekijk het dashboard en gebruik de AI Assistant voor datasetvragen.`,
      "file-formats": `UseClevr ondersteunt ${uploadFormats} voor standaarddatasets. Gespecialiseerde Accountancy-uploads staan in de Accountancy-omgeving.`,
      uploads: `Open Upload en voeg een bestand in een ondersteund formaat (${uploadFormats}) toe. UseClevr accepteert deze datasettypen: ${uploadTypes}.`,
      "upload-trouble": context.usage?.limitReached ? buildUploadLimitAnswer(context, language) : `Controleer of het bestand een ondersteund formaat (${uploadFormats}) gebruikt, duidelijke headers heeft, geen tijdelijk spreadsheet-lockbestand is en binnen je planlimieten valt.`,
      datasets: "Datasets zijn de geüploade bestanden die UseClevr gebruikt voor dashboards, rapporten en AI Assistant-context.",
      dashboard: "Het dashboard vat KPI's, business health, risico's, kansen, aanbevelingen, activiteit en rapportacties samen.",
      credits: buildCreditsAnswer(context, language),
      plans: `Free bevat ${plans.free.monthlyCredits} AI credits en maximaal ${plans.free.maxDatasets} datasets. Pro kost €40/maand. Business kost €420/maand.`,
      billing: "Billing, abonnementen, betalingsgegevens, checkout, facturen en planacties staan in de veilige billing- en accountinstellingen.",
      reports: "Rapporten zetten afgeronde analyses om in deelbare managementsamenvattingen met PDF- of Excel-downloads wanneer die exports beschikbaar zijn.",
      retail: "UseClevr helpt kleine retailers om verkoop- en voorraaddata om te zetten in omzet-, marge-, voorraadrisico-, dead-stock- en productprestatie-inzichten.",
      accountancy: "Accountancy ondersteunt bookkeeping-uploads, factuur- en bonverwerking, belastingreview, categorisatie, reviewqueues en exports.",
      governance: "AI Governance legt transparantie, providerstatus, menselijke controle en auditgereedheid uit. Adminweergaven blijven rolgebonden.",
      integrations: "UseClevr ondersteunt bestandsuploads, actieve Retail-integraties, Local AI-hulpen en BYOK AI-providerinstellingen.",
      support: "Ik kan je hier helpen of een bevestigde contactaanvraag voorbereiden voor Sales, Technical Support / IT, Billing, Management of Executive Management.",
    },
    spanish: {
      languages: `Sí. Puedo ayudar en ${supportedUsyLanguageLabel}.`,
      capabilities: `UseClevr es para dueños de negocio, retailers, equipos de operaciones, contabilidad y equipos en crecimiento que necesitan decisiones claras desde uploads de datos empresariales. Los formatos estándar admitidos son ${uploadFormats}. Sube datos, revisa el dashboard y usa AI Assistant para preguntas sobre datasets.`,
      "file-formats": `UseClevr admite ${uploadFormats} para datasets estándar. Las cargas especializadas de Accountancy aparecen dentro del área Accountancy.`,
      uploads: `Abre Upload y añade un archivo en un formato admitido (${uploadFormats}). UseClevr acepta estos tipos de dataset: ${uploadTypes}.`,
      "upload-trouble": context.usage?.limitReached ? buildUploadLimitAnswer(context, language) : `Comprueba que el archivo use un formato admitido (${uploadFormats}), tenga encabezados claros, no sea un archivo temporal de bloqueo y esté dentro de los límites de tu plan.`,
      datasets: "Los datasets son los archivos subidos que UseClevr usa para dashboards, informes y contexto del AI Assistant.",
      dashboard: "El dashboard resume KPI, salud del negocio, riesgos, oportunidades, recomendaciones, actividad y acciones de informes.",
      credits: buildCreditsAnswer(context, language),
      plans: `Free incluye ${plans.free.monthlyCredits} créditos AI y hasta ${plans.free.maxDatasets} datasets. Pro cuesta €40/mes. Business cuesta €420/mes.`,
      billing: "Facturación, suscripciones, pagos, checkout, facturas y acciones de plan se gestionan en la configuración segura de billing y cuenta.",
      reports: "Los informes convierten análisis completados en resúmenes de gestión compartibles con descargas PDF o Excel cuando estén disponibles.",
      retail: "Retail ayuda con inventario, riesgos de stock, dead stock, rendimiento de producto, márgenes, ingresos e integraciones.",
      accountancy: "Accountancy cubre cargas contables, procesamiento de facturas y recibos, revisión fiscal, categorización, colas de revisión y exportaciones.",
      governance: "AI Governance explica transparencia, estado de proveedores, control humano y preparación de auditoría. Las vistas admin siguen restringidas por rol.",
      integrations: "UseClevr admite cargas de archivos, integraciones Retail activas, ayudas Local AI y configuración de proveedores BYOK AI.",
      support: "Puedo orientarte aquí o preparar una solicitud de contacto confirmada para Sales, Technical Support / IT, Billing, Management o Executive Management.",
    },
    hungarian: {
      languages: `Igen. Tudok segíteni ezeken a nyelveken: ${supportedUsyLanguageLabel}.`,
      capabilities: `A UseClevr vállalkozóknak, retail csapatoknak, operációs vezetőknek, könyvelésnek és növekvő csapatoknak készül, akik üzleti adatfeltöltésekből akarnak dönthető képet kapni. A támogatott standard upload formátumok: ${uploadFormats}. Tölts fel adatot, nézd meg a dashboardot, és dataset-kérdéshez használd az AI Assistantot.`,
      "file-formats": `A UseClevr ${uploadFormats} formátumokat támogat standard datasetekhez. A speciális Accountancy feltöltések az Accountancy területen láthatók.`,
      uploads: `Nyisd meg az Upload részt, és adj hozzá támogatott formátumú fájlt (${uploadFormats}). A támogatott dataset típusok: ${uploadTypes}.`,
      "upload-trouble": context.usage?.limitReached ? buildUploadLimitAnswer(context, language) : `Ellenőrizd, hogy a fájl támogatott formátumú (${uploadFormats}), van világos fejléc, nem ideiglenes táblázat-zárfájl, és belefér a csomagod limitjeibe.`,
      datasets: "A datasetek azok a feltöltött fájlok, amelyeket a UseClevr dashboardokhoz, riportokhoz és AI Assistant kontextushoz használ.",
      dashboard: "A dashboard összefoglalja a KPI-ket, üzleti egészséget, kockázatokat, lehetőségeket, ajánlásokat, aktivitást és riport műveleteket.",
      credits: buildCreditsAnswer(context, language),
      plans: `A Free ${plans.free.monthlyCredits} AI kreditet és legfeljebb ${plans.free.maxDatasets} datasetet tartalmaz. A Pro ára €40/hó. A Business ára €420/hó.`,
      billing: "A billing, előfizetés, fizetési adatok, checkout, számlák és csomagműveletek a biztonságos billing és account beállításokban kezelhetők.",
      reports: "A riportok a befejezett elemzéseket megosztható vezetői összefoglalókká alakítják PDF vagy Excel letöltéssel, amikor elérhető.",
      retail: "A Retail segít készlet, készletkockázat, dead stock, termékteljesítmény, margin, bevétel és integrációs állapot áttekintésében.",
      accountancy: "Az Accountancy könyvelési feltöltéseket, számla- és nyugtafeldolgozást, adóellenőrzést, kategorizálást, review queue-kat és exportokat támogat.",
      governance: "Az AI Governance átláthatóságot, provider státuszt, emberi kontrollt és auditkészültséget magyaráz. Az admin nézetek szerepkörhöz kötöttek.",
      integrations: "A UseClevr fájlfeltöltést, aktív Retail integrációkat, Local AI segítőket és BYOK AI provider beállításokat támogat.",
      support: "Segíthetek itt, vagy előkészíthetek egy megerősített kontaktkérést Sales, Technical Support / IT, Billing, Management vagy Executive Management részére.",
    },
    romanian: {
      languages: `Da. Te pot ajuta în ${supportedUsyLanguageLabel}.`,
      capabilities: `UseClevr este pentru antreprenori, retaileri, echipe operaționale, contabilitate și echipe în creștere care vor decizii clare din uploaduri de date business. Formatele standard acceptate sunt ${uploadFormats}. Încarcă date, verifică dashboardul și folosește AI Assistant pentru întrebări despre setul de date.`,
      "file-formats": `UseClevr acceptă ${uploadFormats} pentru seturi de date standard. Uploadurile specializate Accountancy apar în zona Accountancy.`,
      uploads: `Deschide Upload și adaugă un fișier într-un format acceptat (${uploadFormats}). UseClevr acceptă aceste tipuri de seturi de date: ${uploadTypes}.`,
      "upload-trouble": context.usage?.limitReached ? buildUploadLimitAnswer(context, language) : `Verifică dacă fișierul folosește un format acceptat (${uploadFormats}), are antete clare, nu este un fișier temporar de blocare și se încadrează în limitele planului.`,
      datasets: "Seturile de date sunt fișierele încărcate pe care UseClevr le folosește pentru dashboarduri, rapoarte și contextul AI Assistant.",
      dashboard: "Dashboardul sumarizează KPI-uri, sănătatea afacerii, riscuri, oportunități, recomandări, activitate și acțiuni de raportare.",
      credits: buildCreditsAnswer(context, language),
      plans: `Free include ${plans.free.monthlyCredits} credite AI și până la ${plans.free.maxDatasets} seturi de date. Pro costă €40/lună. Business costă €420/lună.`,
      billing: "Billingul, abonamentele, plățile, checkoutul, facturile și acțiunile de plan se gestionează în setările securizate de billing și cont.",
      reports: "Rapoartele transformă analizele finalizate în rezumate de management partajabile cu descărcări PDF sau Excel când sunt disponibile.",
      retail: "Retail ajută cu inventar, riscuri de stoc, dead stock, performanța produselor, marje, venituri și statusul integrărilor.",
      accountancy: "Accountancy susține uploaduri contabile, procesare facturi și chitanțe, revizuire taxe, categorizare, cozi de review și exporturi.",
      governance: "AI Governance explică transparența, statusul providerilor, controlul uman și pregătirea pentru audit. Vizualizările admin rămân restricționate pe rol.",
      integrations: "UseClevr susține uploaduri de fișiere, integrări Retail active, ajutor Local AI și setări pentru provideri BYOK AI.",
      support: "Te pot ghida aici sau pot pregăti o solicitare de contact confirmată către Sales, Technical Support / IT, Billing, Management sau Executive Management.",
    },
  };

  return answers[language][intentId] ?? null;
}

function localizedTermAnswer(termId: string, language: SupportedUsyLanguage) {
  const terms: Record<SupportedUsyLanguage, Partial<Record<string, string>>> = {
    english: {},
    german: {
      kpi: "Ein KPI ist eine zentrale Kennzahl, die zeigt, ob ein Geschäftsbereich gesund ist, sich verbessert oder Aufmerksamkeit braucht.",
      "gross-margin": "Die Bruttomarge zeigt, welcher Anteil des Umsatzes nach direkten Kosten übrig bleibt.",
      "cash-flow": "Cashflow ist die Bewegung von Geld in ein Unternehmen hinein und aus ihm heraus.",
      forecast: "Ein Forecast ist eine Schätzung zukünftiger Ergebnisse auf Basis verfügbarer Daten.",
    },
    dutch: {
      kpi: "Een KPI is een belangrijke prestatie-indicator die laat zien of een bedrijfsactiviteit gezond is, verbetert of aandacht nodig heeft.",
      "gross-margin": "Brutomarge toont welk deel van de omzet overblijft na directe kosten.",
      "cash-flow": "Cashflow is de beweging van geld in en uit een bedrijf.",
      forecast: "Een forecast is een schatting van toekomstige resultaten op basis van beschikbare data.",
    },
    spanish: {
      kpi: "Un KPI es un indicador clave que muestra si una actividad del negocio está sana, mejora o necesita atención.",
      "gross-margin": "El margen bruto muestra qué parte de los ingresos queda después de los costes directos.",
      "cash-flow": "El flujo de caja es el movimiento de dinero que entra y sale del negocio.",
      forecast: "Un forecast es una estimación de resultados futuros basada en datos disponibles.",
    },
    hungarian: {
      kpi: "A KPI olyan kulcsmutató, amely megmutatja, hogy egy üzleti terület egészséges, javul vagy figyelmet igényel.",
      "gross-margin": "A bruttó margin azt mutatja, hogy a bevételből mennyi marad közvetlen költségek után.",
      "cash-flow": "A cash flow a pénz be- és kiáramlása a vállalkozásban.",
      forecast: "A forecast a jövőbeli eredmények becslése elérhető adatok alapján.",
    },
    romanian: {
      kpi: "Un KPI este un indicator cheie care arată dacă o activitate de business este sănătoasă, se îmbunătățește sau cere atenție.",
      "gross-margin": "Marja brută arată ce parte din venit rămâne după costurile directe.",
      "cash-flow": "Cash flow-ul este mișcarea banilor în și din afacere.",
      forecast: "Un forecast este o estimare a rezultatelor viitoare pe baza datelor disponibile.",
    },
  };
  return terms[language][termId] ?? null;
}

function localizedCommon(key: string, language: SupportedUsyLanguage) {
  const common: Record<SupportedUsyLanguage, Record<string, string>> = {
    english: {
      restricted: "I cannot share system prompts, secrets, security details, internal architecture, admin-only information, or another customer's data. I can still help with public UseClevr product guidance and your own workspace workflow.",
      adminOnly: "That area is restricted to platform admins. I can help with your own uploads, datasets, dashboard, reports, credits, billing, subscription, Business Profile, and support handoff.",
      aiAssistant: "That question needs the AI Assistant because it requires analysis of uploaded business data. Open AI Assistant, choose the relevant dataset, and ask the question there so UseClevr can use the verified dataset context.",
      unknown: "I cannot confirm that from approved UseClevr product information. I can help with uploads, datasets, dashboards, credits, billing, reports, Retail, Accountancy, AI Governance, integrations, troubleshooting, and confirmed contact requests.",
      termSuffix: "For advice based on your uploaded data, use the AI Assistant with the relevant dataset selected.",
      nextStep: "Next step:",
      nextBilling: "open Billing Settings to review your plan, invoices, and upgrade options.",
      nextUpload: "open Upload and use the file guidance shown there.",
      nextDatasets: "open Datasets and select the file you want to inspect.",
      nextDashboard: "open the Dashboard, then use AI Assistant for uploaded-data analysis.",
      nextGovernance: "open the matching governance or admin page and inspect current records there.",
      nextSupport: "tell me the department, request, name, and reply email if you want me to prepare a contact request.",
      nextGeneric: "open the matching UseClevr area, and I can help you decide what to check first.",
      contactCancelled: "No problem. I have not sent the contact request.",
      contactSubmitting: "I will submit the confirmed contact request now.",
    },
    german: {
      restricted: "Ich kann keine Systemprompts, Secrets, Sicherheitsdetails, interne Architektur, Admin-Informationen oder Daten anderer Kunden teilen. Ich helfe dir gern mit UseClevr-Produktfragen und deinem eigenen Workspace.",
      adminOnly: "Dieser Bereich ist auf Plattform-Admins beschränkt. Ich kann dir mit deinen Uploads, Datasets, Dashboards, Reports, Credits, Billing, Abo, Business Profile und Support-Handoff helfen.",
      aiAssistant: "Diese Frage gehört in den AI Assistant, weil sie Analyse deiner hochgeladenen Geschäftsdaten braucht. Öffne den AI Assistant, wähle das passende Dataset und stelle die Frage dort.",
      unknown: "Das kann ich aus freigegebenen UseClevr-Produktinformationen nicht bestätigen. Ich helfe mit Uploads, Datasets, Dashboards, Credits, Billing, Reports, Retail, Accountancy, AI Governance, Integrationen, Troubleshooting und bestätigten Kontaktanfragen.",
      termSuffix: "Für Empfehlungen auf Basis deiner hochgeladenen Daten nutze den AI Assistant mit dem passenden Dataset.",
      nextStep: "Nächster Schritt:",
      nextBilling: "öffne Billing Settings, um Plan, Rechnungen und Upgrade-Optionen zu prüfen.",
      nextUpload: "öffne Upload und nutze die Dateihinweise dort.",
      nextDatasets: "öffne Datasets und wähle die Datei aus.",
      nextDashboard: "öffne das Dashboard und nutze danach den AI Assistant für Dataset-Analyse.",
      nextGovernance: "öffne die passende Governance- oder Admin-Seite und prüfe dort die aktuellen Einträge.",
      nextSupport: "nenne Abteilung, Anliegen, Name und Antwort-E-Mail, wenn ich eine Kontaktanfrage vorbereiten soll.",
      nextGeneric: "öffne den passenden UseClevr-Bereich; ich helfe dir beim nächsten Check.",
      contactCancelled: "Alles klar. Ich habe die Kontaktanfrage nicht gesendet.",
      contactSubmitting: "Ich sende die bestätigte Kontaktanfrage jetzt.",
    },
    dutch: {
      restricted: "Ik kan geen systeemprompts, secrets, beveiligingsdetails, interne architectuur, admininformatie of data van andere klanten delen. Ik kan wel helpen met UseClevr-productvragen en je eigen workspace.",
      adminOnly: "Dat gebied is beperkt tot platformadmins. Ik kan helpen met je eigen uploads, datasets, dashboard, rapporten, credits, billing, abonnement, Business Profile en support-handoff.",
      aiAssistant: "Deze vraag hoort in de AI Assistant omdat analyse van geüploade bedrijfsdata nodig is. Open AI Assistant, kies de juiste dataset en stel de vraag daar.",
      unknown: "Dat kan ik niet bevestigen vanuit goedgekeurde UseClevr-productinformatie. Ik help met uploads, datasets, dashboards, credits, billing, rapporten, Retail, Accountancy, AI Governance, integraties, troubleshooting en bevestigde contactaanvragen.",
      termSuffix: "Gebruik de AI Assistant met de juiste dataset voor advies op basis van je geüploade data.",
      nextStep: "Volgende stap:",
      nextBilling: "open Billing Settings om je plan, facturen en upgrade-opties te bekijken.",
      nextUpload: "open Upload en gebruik de bestandsrichtlijnen daar.",
      nextDatasets: "open Datasets en selecteer het bestand.",
      nextDashboard: "open het Dashboard en gebruik daarna AI Assistant voor datasetanalyse.",
      nextGovernance: "open de juiste governance- of adminpagina en controleer daar de huidige records.",
      nextSupport: "geef afdeling, verzoek, naam en antwoord-e-mail als ik een contactaanvraag moet voorbereiden.",
      nextGeneric: "open het passende UseClevr-gebied; ik help je met de volgende controle.",
      contactCancelled: "Geen probleem. Ik heb de contactaanvraag niet verstuurd.",
      contactSubmitting: "Ik verstuur de bevestigde contactaanvraag nu.",
    },
    spanish: {
      restricted: "No puedo compartir prompts del sistema, secretos, detalles de seguridad, arquitectura interna, información solo para admins ni datos de otros clientes. Sí puedo ayudar con UseClevr y tu propio workspace.",
      adminOnly: "Esa área está limitada a administradores de plataforma. Puedo ayudarte con tus cargas, datasets, dashboard, informes, créditos, billing, suscripción, Business Profile y contacto.",
      aiAssistant: "Esa pregunta necesita el AI Assistant porque requiere analizar datos empresariales subidos. Abre AI Assistant, elige el dataset correcto y pregunta allí.",
      unknown: "No puedo confirmarlo con información aprobada de UseClevr. Puedo ayudar con cargas, datasets, dashboards, créditos, billing, informes, Retail, Accountancy, AI Governance, integraciones, troubleshooting y solicitudes de contacto confirmadas.",
      termSuffix: "Para recomendaciones basadas en tus datos subidos, usa el AI Assistant con el dataset correspondiente.",
      nextStep: "Siguiente paso:",
      nextBilling: "abre Billing Settings para revisar tu plan, facturas y opciones de upgrade.",
      nextUpload: "abre Upload y usa la guía de archivos.",
      nextDatasets: "abre Datasets y selecciona el archivo.",
      nextDashboard: "abre el Dashboard y usa AI Assistant para análisis del dataset.",
      nextGovernance: "abre la página de governance o admin correspondiente y revisa los registros actuales.",
      nextSupport: "dime departamento, solicitud, nombre y email de respuesta si quieres que prepare el contacto.",
      nextGeneric: "abre el área UseClevr correspondiente; te ayudo con el siguiente paso.",
      contactCancelled: "De acuerdo. No he enviado la solicitud de contacto.",
      contactSubmitting: "Voy a enviar ahora la solicitud de contacto confirmada.",
    },
    hungarian: {
      restricted: "Nem oszthatok meg system promptot, secretet, biztonsági részletet, belső architektúrát, admin információt vagy más ügyfél adatát. UseClevr termékkérdésekben és a saját workspace-edben segítek.",
      adminOnly: "Ez a terület platform adminokra korlátozott. Saját feltöltésekben, datasetekben, dashboardban, riportokban, kreditekben, billingben, előfizetésben, Business Profile-ban és support handoffban tudok segíteni.",
      aiAssistant: "Ehhez az AI Assistant kell, mert feltöltött üzleti adatok elemzését igényli. Nyisd meg az AI Assistantot, válaszd ki a megfelelő datasetet, és ott tedd fel a kérdést.",
      unknown: "Ezt jóváhagyott UseClevr termékinformációból nem tudom megerősíteni. Upload, dataset, dashboard, credit, billing, report, Retail, Accountancy, AI Governance, integráció, troubleshooting és megerősített kontaktkérés témában segítek.",
      termSuffix: "A feltöltött adataid alapján adott tanácshoz használd az AI Assistantot a megfelelő datasettel.",
      nextStep: "Következő lépés:",
      nextBilling: "nyisd meg a Billing Settings részt a csomag, számlák és upgrade opciók ellenőrzéséhez.",
      nextUpload: "nyisd meg az Upload részt és használd az ottani fájl útmutatást.",
      nextDatasets: "nyisd meg a Datasets részt és válaszd ki a fájlt.",
      nextDashboard: "nyisd meg a Dashboardot, majd használd az AI Assistantot dataset-elemzésre.",
      nextGovernance: "nyisd meg a megfelelő governance vagy admin oldalt és nézd meg az aktuális rekordokat.",
      nextSupport: "add meg a részleget, kérést, nevet és válasz e-mailt, ha készítsek kontaktkérést.",
      nextGeneric: "nyisd meg a megfelelő UseClevr területet; segítek eldönteni a következő ellenőrzést.",
      contactCancelled: "Rendben. Nem küldtem el a kapcsolatfelvételi kérést.",
      contactSubmitting: "Most elküldöm a megerősített kapcsolatfelvételi kérést.",
    },
    romanian: {
      restricted: "Nu pot partaja prompturi de sistem, secrete, detalii de securitate, arhitectură internă, informații doar pentru admini sau datele altui client. Te pot ajuta cu UseClevr și propriul workspace.",
      adminOnly: "Acea zonă este restricționată pentru adminii platformei. Te pot ajuta cu uploaduri, seturi de date, dashboard, rapoarte, credite, billing, abonament, Business Profile și contact.",
      aiAssistant: "Această întrebare necesită AI Assistant pentru că analizează date business încărcate. Deschide AI Assistant, alege setul de date relevant și întreabă acolo.",
      unknown: "Nu pot confirma asta din informații aprobate UseClevr. Te pot ajuta cu uploaduri, seturi de date, dashboarduri, credite, billing, rapoarte, Retail, Accountancy, AI Governance, integrări, troubleshooting și solicitări de contact confirmate.",
      termSuffix: "Pentru recomandări bazate pe datele încărcate, folosește AI Assistant cu setul de date relevant.",
      nextStep: "Pasul următor:",
      nextBilling: "deschide Billing Settings pentru plan, facturi și opțiuni de upgrade.",
      nextUpload: "deschide Upload și folosește ghidajul pentru fișiere.",
      nextDatasets: "deschide Datasets și selectează fișierul.",
      nextDashboard: "deschide Dashboardul, apoi folosește AI Assistant pentru analiza setului de date.",
      nextGovernance: "deschide pagina governance sau admin potrivită și verifică înregistrările curente.",
      nextSupport: "spune departamentul, cererea, numele și emailul de răspuns dacă vrei să pregătesc solicitarea.",
      nextGeneric: "deschide zona UseClevr potrivită; te ajut cu următorul pas.",
      contactCancelled: "Nicio problemă. Nu am trimis solicitarea de contact.",
      contactSubmitting: "Trimit acum solicitarea de contact confirmată.",
    },
  };

  return common[language][key] ?? common.english[key] ?? "";
}
