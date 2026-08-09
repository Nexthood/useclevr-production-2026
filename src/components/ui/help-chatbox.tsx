"use client";

import usyAvatar from "@/assets/images/avatar.png";
import { Button } from "@/components/ui/button";
import { UPLOAD_CREDIT_LIMIT_BUTTONS, buildUploadCreditLimitCopy, buildUploadCreditLimitMessage } from "@/lib/billing/upload-credit-messaging";
import { publicMonthlyPlanPrices, publicProMonthlyLaunchPrices } from "@/lib/billing/plans";
import { ArrowUp, Bot, Loader2, Sparkles, X } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  source?: "ai" | "knowledge";
  followUps?: string[];
};

type HelpChatboxAudience = "public" | "dashboard" | "superadmin";

type UsyRole = "public" | "user" | "admin" | "superadmin";

type UsyUsageContext = {
  subscriptionTier?: string;
  analysisCount?: number;
  total?: number;
  limitReached?: boolean;
  unlimited?: boolean;
  unlimitedLabel?: string | null;
};

type UsyContext = {
  audience: HelpChatboxAudience;
  role: UsyRole;
  route: string;
  plan?: string;
  usage?: UsyUsageContext | null;
};

const proLaunchPriceText = publicProMonthlyLaunchPrices.map((price) => price.label).join(", ");

type SupportedUsyLanguage = "english" | "german" | "dutch" | "spanish" | "hungarian" | "romanian";

type UsyIntent = {
  id: string;
  label: string;
  keywords: string[];
  roles?: UsyRole[];
  minScore?: number;
  answer: (context: UsyContext) => string;
  followUps: readonly string[];
};

const starterSuggestions = [
  "What can you do?",
  "Explain AI credits",
  "Why is my upload blocked?",
  "Which plan do I need?",
  "Help me analyze my data",
];

const capabilities = [
  "Uploads",
  "Datasets",
  "Dashboards",
  "AI Analysis",
  "Forecasting",
  "Reports",
  "Business Intelligence",
  "KPIs",
  "CSV imports",
  "Retail Analytics",
  "Inventory",
  "Billing",
  "Credits",
  "Settings",
  "Integrations",
  "Troubleshooting",
];

const fallbackFollowUps = [
  "Upload my first dataset",
  "Explain my dashboard",
  "How do AI credits work?",
  "Contact support",
];

const pricingFollowUps = [
  "Compare Free vs Pro",
  "Upgrade to Pro",
  "Business plan",
  "Billing & invoices",
];

const userFollowUps = {
  upload: ["Prepare my CSV", "File formats", "Upload limit", "Analyze my dataset"],
  dashboard: [
    "Explain these KPIs",
    "What does this score mean?",
    "Show business opportunities",
    "How can I improve this result?",
  ],
  billing: pricingFollowUps,
  forecast: [
    "What columns are needed?",
    "Why did forecast fail?",
    "Forecast my sales",
    "Improve forecast accuracy",
  ],
  credits: ["How do AI credits work?", "Upgrade to Pro", "View Billing Settings", "Upload limit"],
  profile: [
    "What profile fields matter?",
    "Complete Business Profile",
    "How does profile data improve AI?",
    "What should I enter first?",
  ],
  reports: ["Generate a report", "Download reports", "Executive summary", "Share with accountant"],
  integrations: [
    "Connect an AI provider",
    "What integrations are available?",
    "Connect Snowflake",
    "Use local AI analysis",
  ],
} as const;

const platformBrainRoles: UsyRole[] = ["admin", "superadmin"];
const platformBrainFollowUps = [
  "View customers",
  "Check AI traces",
  "Billing settings",
  "Customer levels",
  "Platform status",
];

const supportedLanguageList = "English, German, Dutch, Spanish, Hungarian, and Romanian";

const usyLanguageBadges = [
  { flag: "🇬🇧", label: "English" },
  { flag: "🇩🇪", label: "Deutsch" },
  { flag: "🇳🇱", label: "Nederlands" },
  { flag: "🇪🇸", label: "Español" },
  { flag: "🇭🇺", label: "Magyar" },
  { flag: "🇷🇴", label: "Română" },
] as const;

const usyDomainKeywords = [
  "useclevr",
  "csv",
  "excel",
  "upload",
  "dataset",
  "data",
  "dashboard",
  "analysis",
  "analytics",
  "ai",
  "credit",
  "credits",
  "plan",
  "free",
  "pro",
  "business",
  "retail",
  "inventory",
  "revenue",
  "margin",
  "stock",
  "accountancy",
  "invoice",
  "receipt",
  "report",
  "download",
  "pdf",
  "export",
  "billing",
  "subscription",
  "profile",
  "troubleshoot",
  "upgrade",
  "demo",
  "verification",
  "email",
  "datensatz",
  "hochladen",
  "rechnung",
  "beleg",
  "umsatz",
  "marge",
  "voorraad",
  "factuur",
  "gegevens",
  "subir",
  "factura",
  "inventario",
  "ingresos",
  "magyarazd",
  "magyarázd",
  "adat",
  "feltoltes",
  "feltöltés",
  "szamla",
  "számla",
  "keszlet",
  "készlet",
  "bevetel",
  "bevétel",
  "incarcare",
  "încărcare",
  "stoc",
  "abonament",
];

const unrelatedKeywords = [
  "hobby",
  "hobbies",
  "philosophy",
  "politics",
  "movie",
  "music",
  "celebrity",
  "relationship",
  "dating",
  "personal advice",
  "joke",
  "game",
  "sport",
  "sports",
  "religion",
  "party",
  "travel",
  "weather",
  "cook",
  "recipe",
  "hobbys",
  "politik",
  "filme",
  "musik",
  "beziehung",
  "hobby s",
  "politiek",
  "film",
  "muziek",
  "relatie",
  "politica",
  "política",
  "pelicula",
  "película",
  "musica",
  "música",
  "relacion",
  "relación",
  "politika",
  "film",
  "zene",
  "kapcsolat",
  "politica",
  "muzica",
  "relație",
  "relatie",
];

const usyIntents: UsyIntent[] = [
  {
    id: "languages",
    label: "Languages",
    keywords: [
      "do you speak other languages",
      "other languages",
      "which languages",
      "what languages",
      "speak german",
      "speak dutch",
      "speak spanish",
      "speak hungarian",
      "speak romanian",
      "sprichst du deutsch",
      "andere sprachen",
      "spreek je nederlands",
      "hablas espanol",
      "hablas español",
      "beszelsz magyarul",
      "beszélsz magyarul",
      "vorbesti romana",
      "vorbești română",
    ],
    followUps: [
      "What can you do?",
      "Explain AI credits",
      "Help me analyze my data",
      "Which plan do I need?",
    ],
    answer: () => `Yes. I can help in ${supportedLanguageList}.`,
  },
  {
    id: "capabilities",
    label: "Capabilities",
    keywords: [
      "what can you do",
      "what do you do",
      "how can you help",
      "help me",
      "your skills",
      "capabilities",
      "can you help",
      "mit tudsz",
      "was kannst du",
      "wat kun je",
      "que puedes hacer",
      "ce poti face",
      "ce poți face",
    ],
    followUps: [
      "Help me analyze my data",
      "Explain AI credits",
      "Why is my upload blocked?",
      "Which plan do I need?",
    ],
    answer: () =>
      "I can help you upload CSV and Excel files, understand datasets, explain dashboards, analyze business performance, find risks and opportunities, explain AI credits, choose a plan, troubleshoot uploads, work with retail inventory, understand accountancy features, and prepare reports.",
  },
  {
    id: "pro-pricing",
    label: "Pro pricing",
    keywords: [
      "price pro",
      "pro price",
      "pricing pro",
      "pro pricing",
      "cost pro",
      "pro cost",
      "pro plan",
      "upgrade pro",
      "upgrade to pro",
      "how much pro",
      "pro",
    ],
    minScore: 3,
    followUps: pricingFollowUps,
    answer: () =>
      `Pro launch pricing is ${proLaunchPriceText}. It includes 500 AI credits per month, up to 25 datasets, AI business analysis, revenue and margin analysis, stock detection, reports, exports, and priority support. You can upgrade from Billing Settings.`,
  },
  {
    id: "business-pricing",
    label: "Business pricing",
    keywords: [
      "business price",
      "price business",
      "business pricing",
      "cost business",
      "business cost",
      "business plan",
      "upgrade business",
      "upgrade to business",
      "how much business",
    ],
    minScore: 3,
    followUps: pricingFollowUps,
    answer: () =>
      `Business is €${publicMonthlyPlanPrices.business}/month. It includes everything in Pro, 5000 AI credits per month, up to 250 datasets, larger file upload limits, Accounting AI, invoice processing, receipt processing, and dedicated support. You can start from Billing Settings.`,
  },
  {
    id: "pricing-general",
    label: "Pricing",
    keywords: [
      "price",
      "pricing",
      "cost",
      "costs",
      "plans",
      "subscription",
      "upgrade",
      "compare free pro",
      "free vs pro",
      "which plan",
      "which plan do i need",
      "plan do i need",
      "business differ from pro",
      "business vs pro",
      "pro vs business",
      "compare pro business",
    ],
    followUps: pricingFollowUps,
    answer: () =>
      `Pro launch pricing is ${proLaunchPriceText}. Business is €${publicMonthlyPlanPrices.business}/month. Free is for trying the workflow with 50 AI credits and 2 datasets; Pro adds 500 AI credits, 25 datasets, business analysis, reports, exports, and priority support; Business adds everything in Pro, 5000 AI credits, 250 datasets, larger uploads, Accounting AI, document processing, and dedicated support.`,
  },
  {
    id: "upload",
    label: "Uploads",
    keywords: ["upload", "csv", "excel", "first dataset", "import"],
    followUps: userFollowUps.upload,
    answer: () =>
      "Start with Upload, then drag in a CSV or Excel file. UseClevr profiles the columns, checks data quality, detects KPIs, and prepares an analysis workspace. For the best result, keep headers clear and include date, revenue, product, customer, cost, or quantity columns when available.",
  },
  {
    id: "upload-trouble",
    label: "Upload troubleshooting",
    keywords: [
      "upload not working",
      "upload failed",
      "can't upload",
      "cannot upload",
      "file failed",
      "csv failed",
      "excel failed",
      "upload error",
      "upload limit",
      "upload blocked",
      "why is my upload blocked",
      "blocked upload",
    ],
    followUps: userFollowUps.upload,
    answer: (context) => {
      if (context.usage?.limitReached) {
        return "Your upload is blocked because your current plan limit is reached, not because the file failed. Open Billing Settings and upgrade to Pro or Business to continue uploading datasets.";
      }
      return "If upload is not working, first check that the file is CSV or Excel, has clear column headers, and is within your plan limits. If the message mentions a Free plan limit, use Billing Settings to upgrade. If it mentions file parsing, simplify merged cells or unusual formatting and try again.";
    },
  },
  {
    id: "dashboard",
    label: "Dashboard",
    keywords: ["dashboard", "explain", "home", "health score", "business health"],
    followUps: userFollowUps.dashboard,
    answer: () =>
      "Your dashboard summarizes business health, KPIs, risks, opportunities, recommendations, and recent activity. Treat it like a management briefing: first check the health score, then review the highest-risk items and the next recommended action.",
  },
  {
    id: "analysis",
    label: "AI analysis",
    keywords: ["analyze", "analysis", "ai analysis", "csv analysis", "insight"],
    followUps: [
      "Analyze my CSV",
      "Explain my dashboard",
      "Find business opportunities",
      "Generate a report",
    ],
    answer: () =>
      "UseClevr analysis combines deterministic calculations with AI explanations. The backend calculates metrics from your uploaded rows, and Usy explains what the results mean, what risks matter, and what you can do next.",
  },
  {
    id: "forecast",
    label: "Forecasting",
    keywords: ["forecast", "sales", "predict", "projection", "trend"],
    followUps: userFollowUps.forecast,
    answer: () =>
      "Forecasting works best when your dataset has a time column and numeric business values such as revenue, sales, profit, quantity, or cost. If forecasting fails, UseClevr should explain which required columns or row counts are missing instead of guessing.",
  },
  {
    id: "business-profile",
    label: "Business Profile",
    keywords: ["business profile", "profile", "setup", "company"],
    followUps: userFollowUps.profile,
    answer: () =>
      "The Business Profile helps UseClevr personalize analysis for your company. Add your industry, region, currency, size, goals, role, and data purpose so dashboards, recommendations, and reports use the right business context.",
  },
  {
    id: "credits",
    label: "Credits",
    keywords: ["credit", "credits", "free credits", "ai credits"],
    followUps: userFollowUps.credits,
    answer: (context) => buildUsyCreditsExplanation(context),
  },
  {
    id: "billing",
    label: "Billing",
    keywords: [
      "billing",
      "invoice",
      "invoices",
      "stripe",
      "subscription",
      "payment",
      "card",
      "receipt",
      "receipts",
    ],
    followUps: userFollowUps.billing,
    answer: () =>
      `Billing and invoices are managed through the secure Stripe flow in Settings. Pro launch pricing is ${proLaunchPriceText}. Business is €${publicMonthlyPlanPrices.business}/month. You can review your plan, open checkout, manage payment details, and access billing actions from the account and billing areas.`,
  },
  {
    id: "integrations",
    label: "Integrations",
    keywords: ["snowflake", "integration", "connect", "warehouse", "database"],
    followUps: userFollowUps.integrations,
    answer: () =>
      "Snowflake and deeper data-warehouse connectors are planned as integration features. For now, upload CSV or Excel exports, or use AI Providers if you want to connect your own AI engine for analysis routing.",
  },
  {
    id: "support",
    label: "Support",
    keywords: ["support", "ticket", "contact", "help", "human"],
    followUps: ["Create a ticket", "Troubleshoot upload", "Billing & invoices", "Contact support"],
    answer: () =>
      "I can guide you here, and you can also create a dashboard ticket or contact support. Describe the issue, include the dataset or page involved, and UseClevr support can follow up with the right context.",
  },
  {
    id: "retail",
    label: "Retail Analytics",
    keywords: [
      "retail",
      "inventory",
      "stock",
      "sku",
      "product",
      "analyze retail inventory",
      "retail inventory",
    ],
    followUps: ["Low stock risks", "Top products", "Inventory optimization", "Analyze my dataset"],
    answer: () =>
      "Retail Analytics helps identify low stock, dead stock, top-profit products, category performance, supplier patterns, and reorder priorities. Include SKU, product, stock, sales, cost, revenue, and date columns for stronger results.",
  },
  {
    id: "reports",
    label: "Reports",
    keywords: ["report", "download", "pdf", "executive summary"],
    followUps: userFollowUps.reports,
    answer: () =>
      "Reports turn your analysis into a shareable management summary. Use them for executive updates, accountant handoff, investor conversations, or internal planning after the dataset analysis is complete.",
  },
  {
    id: "admin-customers",
    label: "Customers",
    roles: platformBrainRoles,
    keywords: [
      "customers",
      "customer",
      "users",
      "user troubleshooting",
      "customer list",
      "which customer has problems",
      "customer problems",
      "user issues",
    ],
    followUps: platformBrainFollowUps,
    answer: () =>
      "The Customers admin area helps platform admins review users, plans, account status, and troubleshooting context. To find customers with problems, check Customers for plan state and account status, then cross-check recent uploads, usage limits, tickets, billing state, and AI traces for the same user.",
  },
  {
    id: "admin-plans",
    label: "Plans",
    roles: platformBrainRoles,
    keywords: [
      "active plan",
      "which plan",
      "plan active",
      "plans",
      "subscription tier",
      "customer plan",
      "user plan",
      "which plan is active",
    ],
    followUps: platformBrainFollowUps,
    answer: () =>
      "Use Customers to inspect the active plan or subscription tier for a user. If the plan looks wrong, check Billing Settings, Stripe checkout status, webhook history if available, and the customer's latest account updates before changing access manually.",
  },
  {
    id: "admin-limits",
    label: "Usage limits",
    roles: platformBrainRoles,
    keywords: [
      "reached limits",
      "users reached limits",
      "limit reached",
      "credits used",
      "dataset limit",
      "upload limit",
      "free limit",
      "usage limit",
    ],
    followUps: platformBrainFollowUps,
    answer: () =>
      "To find users who reached limits, start in Customers for subscription tier and account state, then check usage or upload-limit signals on the affected workflow. Free users are expected to hit included dataset or analyst-credit limits; paid or admin users should not be blocked by Free limits.",
  },
  {
    id: "admin-failed-analysis",
    label: "Failed analyses",
    roles: platformBrainRoles,
    keywords: [
      "failed analyses",
      "analysis failed",
      "failed analysis",
      "forecast failed",
      "upload failed",
      "why did upload fail",
      "why did forecast fail",
      "errors",
      "error",
    ],
    followUps: platformBrainFollowUps,
    answer: () =>
      "For failed uploads, check whether the user hit a plan limit, file parsing issue, missing headers, or row/file limits. For failed forecasts, check whether the dataset has a usable time column, numeric business column, and enough rows. For AI analysis failures, check AI traces and provider status before blaming the dataset.",
  },
  {
    id: "admin-levels",
    label: "Customer levels",
    roles: platformBrainRoles,
    keywords: ["customer levels", "levels", "user levels", "level rules"],
    followUps: platformBrainFollowUps,
    answer: () =>
      "Customer Levels let platform admins review progression rules and customer segmentation. Use them to understand how users move between levels and how rewards or access states are assigned.",
  },
  {
    id: "admin-discounts",
    label: "Discount rules",
    roles: platformBrainRoles,
    keywords: ["discount", "discounts", "discount rules", "coupon", "promo"],
    followUps: platformBrainFollowUps,
    answer: () =>
      "Discount Rules let platform admins review promotional pricing logic. Use Billing Settings and Discount Rules together when checking upgrade offers, coupon issues, and customer subscription questions.",
  },
  {
    id: "admin-billing",
    label: "Billing settings",
    roles: platformBrainRoles,
    keywords: [
      "billing settings",
      "payment settings",
      "stripe settings",
      "plan settings",
      "billing issues",
      "where are billing issues",
      "checkout issue",
      "invoice issue",
    ],
    followUps: platformBrainFollowUps,
    answer: () =>
      "Billing Settings is the platform area for plan configuration, checkout readiness, and payment-provider setup. Use it when pricing, Stripe, checkout, invoices, upgrade paths, or billing access need verification.",
  },
  {
    id: "admin-ai-traces",
    label: "AI traces",
    roles: platformBrainRoles,
    keywords: [
      "ai traces",
      "traces",
      "ai activity",
      "provider usage",
      "audit logs",
      "what happened in ai traces",
      "ai error",
      "provider failed",
    ],
    followUps: platformBrainFollowUps,
    answer: () =>
      "AI Traces show platform admins how AI requests behave: provider usage, request metadata, response status, feedback, retention, fallback, and errors. Use them to debug quality, privacy routing, provider failures, and failed analyses without exposing secrets or raw customer data.",
  },
  {
    id: "admin-ai-benchmarking",
    label: "AI benchmarking",
    roles: platformBrainRoles,
    keywords: ["ai benchmarking", "benchmark", "benchmarks", "model quality"],
    followUps: platformBrainFollowUps,
    answer: () =>
      "AI Benchmarking helps platform admins compare AI provider behavior and response quality. Use it to validate provider changes, quality regressions, and Hybrid AI routing performance.",
  },
  {
    id: "admin-mcp",
    label: "MCP tokens",
    roles: platformBrainRoles,
    keywords: ["mcp", "mcp tokens", "tokens", "api token", "developer token"],
    followUps: platformBrainFollowUps,
    answer: () =>
      "MCP Tokens are platform-controlled credentials for approved UseClevr data and content access. Use this area to create, review, or revoke tokens and keep scopes limited to the intended integration.",
  },
  {
    id: "admin-platform-status",
    label: "Platform status",
    roles: platformBrainRoles,
    keywords: [
      "platform status",
      "status",
      "system status",
      "what should i check next",
      "check next",
      "monitoring",
      "health",
      "platform health",
    ],
    followUps: platformBrainFollowUps,
    answer: () =>
      "For platform status, check the current customer impact first: failed uploads, failed analyses, users at limits, billing issues, and AI provider errors. Then review AI traces, billing settings, customers, and recent tickets to identify whether the problem is user data, plan limits, payment setup, provider routing, or a system error.",
  },
];

function normalizeQuestion(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s?]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function questionTokens(normalized: string) {
  return new Set(normalized.split(" ").filter((token) => token.length > 1));
}

function scoreIntent(normalized: string, tokens: Set<string>, intent: UsyIntent, role: UsyRole) {
  if (intent.roles && !intent.roles.includes(role)) return 0;

  return intent.keywords.reduce((score, keyword) => {
    const normalizedKeyword = normalizeQuestion(keyword);
    if (!normalizedKeyword) return score;
    if (normalized === normalizedKeyword) return score + 8;
    if (normalized.includes(normalizedKeyword))
      return score + (normalizedKeyword.includes(" ") ? 5 : 3);
    return score + normalizedKeyword.split(" ").filter((part) => tokens.has(part)).length;
  }, 0);
}

function detectIntent(question: string, role: UsyRole) {
  const normalized = normalizeQuestion(question);
  const tokens = questionTokens(normalized);

  return (
    usyIntents
      .map((intent) => ({ intent, score: scoreIntent(normalized, tokens, intent, role) }))
      .filter(({ intent, score }) => score >= (intent.minScore ?? 2))
      .sort((a, b) => b.score - a.score)[0]?.intent ?? null
  );
}

function detectUsyLanguage(question: string): SupportedUsyLanguage {
  const normalized = normalizeQuestion(question);

  if (
    /\b(deutsch|sprichst|sprechen|kannst du|was kann|andere sprachen|hochladen|rechnung|gutschrift|datensatz|bericht|umsatz|marge|lager)\b/.test(
      normalized,
    )
  ) {
    return "german";
  }
  if (
    /\b(nederlands|spreek|talen|wat kan|uploaden|factuur|gegevensset|gegevens|tegoed|abonnement|voorraad)\b/.test(
      normalized,
    )
  ) {
    return "dutch";
  }
  if (
    /\b(espanol|español|hablas|idiomas|que puede|que puedes|subir|factura|creditos|créditos|conjunto de datos|plan necesito|inventario|ingresos)\b/.test(
      normalized,
    )
  ) {
    return "spanish";
  }
  if (
    /[áéíóöőúüű]/i.test(question) ||
    /\b(magyar|magyarazd|magyarázd|akkor|mit tud|beszelsz|beszélsz|nyelv|feltoltes|feltöltés|szamla|számla|kredit|adat|adatkeszlet|adatkészlet|keszlet|készlet|bevetel|bevétel|melyik csomag)\b/.test(
      normalized,
    )
  ) {
    return "hungarian";
  }
  if (
    /[ăâîșşțţ]/i.test(question) ||
    /\b(romana|română|vorbesti|vorbești|limbi|ce poate|incarcare|încărcare|factura|credite|set de date|abonament|stoc)\b/.test(
      normalized,
    )
  ) {
    return "romanian";
  }

  return "english";
}

function isUseClevrDomainQuestion(normalized: string, role: UsyRole) {
  if (detectIntent(normalized, role)) return true;
  return usyDomainKeywords.some((keyword) => normalized.includes(normalizeQuestion(keyword)));
}

function isUnrelatedQuestion(normalized: string, context: UsyContext) {
  if (isUseClevrDomainQuestion(normalized, context.role)) return false;
  return unrelatedKeywords.some((keyword) => normalized.includes(keyword));
}

function formatDemoUsageText(context: UsyContext) {
  if (context.usage?.unlimited) return context.usage.unlimitedLabel || "unlimited usage";
  if (
    typeof context.usage?.analysisCount === "number" &&
    typeof context.usage?.total === "number"
  ) {
    return `${context.usage.analysisCount}/${context.usage.total}`;
  }
  return null;
}

function buildUsyUploadCreditLimitAnswer(context: UsyContext) {
  const limit = context.usage?.total ?? 2;
  const used = context.usage?.analysisCount ?? limit;
  const creditCopy = buildUploadCreditLimitCopy({ used, limit, remaining: 0 });

  return [
    creditCopy.title,
    "",
    buildUploadCreditLimitMessage(creditCopy.limit),
    "",
    "Actions:",
    `- ${UPLOAD_CREDIT_LIMIT_BUTTONS.compare}`,
    `- ${UPLOAD_CREDIT_LIMIT_BUTTONS.pro}`,
    `- ${UPLOAD_CREDIT_LIMIT_BUTTONS.business}`,
    `- ${UPLOAD_CREDIT_LIMIT_BUTTONS.billing}`,
  ].join("\n");
}

function buildUsyCreditsExplanation(context: UsyContext) {
  const usageText = formatDemoUsageText(context);
  const usageLine = usageText ? `Current upload usage: ${usageText} upload credits used.` : "";

  return [
    "Upload credits control how many files a Free account can successfully upload.",
    usageLine,
    "A successful upload permanently consumes one upload credit.",
    "Failed uploads do not consume upload credits.",
    "Deleting datasets does not restore upload credits.",
    "Retrying the same failed upload should not double-charge credits.",
    "Pro and Business include higher limits or broader upload capacity.",
  ].filter(Boolean).join(" ");
}

function localizedFallbackAnswer(
  question: string,
  context: UsyContext,
  language: SupportedUsyLanguage,
) {
  const normalized = normalizeQuestion(question);
  const unrelated = isUnrelatedQuestion(normalized, context);
  const uploadBlocked =
    context.usage?.limitReached ||
    normalized.includes("upload blocked") ||
    normalized.includes("upload limit") ||
    normalized.includes("upload failed") ||
    normalized.includes("upload not working");
  const wantsLanguages =
    normalized.includes("language") ||
    normalized.includes("languages") ||
    normalized.includes("speak") ||
    normalized.includes("sprich") ||
    normalized.includes("spreek") ||
    normalized.includes("hablas") ||
    normalized.includes("beszel") ||
    normalized.includes("beszél") ||
    normalized.includes("vorbest") ||
    normalized.includes("vorbeș");
  const wantsCapabilities =
    normalized.includes("useclevr mit tud") ||
    normalized.includes("magyarazd el") ||
    normalized.includes("magyarázd el") ||
    normalized.includes("was kann useclevr") ||
    normalized.includes("wat kan useclevr") ||
    normalized.includes("que puede useclevr") ||
    normalized.includes("ce poate useclevr") ||
    normalized.includes("what can you do") ||
    normalized.includes("what can useclevr do") ||
    normalized.includes("how can you help") ||
    normalized.includes("capabilities") ||
    normalized.includes("mit tud") ||
    normalized.includes("mit tudsz") ||
    normalized.includes("was kann") ||
    normalized.includes("was kannst") ||
    normalized.includes("wat kan") ||
    normalized.includes("wat kun") ||
    normalized.includes("que puede") ||
    normalized.includes("que puedes") ||
    normalized.includes("ce poate") ||
    normalized.includes("ce poti") ||
    normalized.includes("ce poți");
  const wantsCredits =
    normalized.includes("credit") ||
    normalized.includes("credits") ||
    normalized.includes("kredit") ||
    normalized.includes("credite");
  const wantsPlan =
    normalized.includes("which plan") ||
    normalized.includes("plan do i need") ||
    normalized.includes("business differ") ||
    normalized.includes("pro") ||
    normalized.includes("business");
  const wantsInvoices =
    normalized.includes("invoice") ||
    normalized.includes("invoices") ||
    normalized.includes("receipt") ||
    normalized.includes("receipts") ||
    normalized.includes("rechnung") ||
    normalized.includes("factuur") ||
    normalized.includes("factura") ||
    normalized.includes("szamla") ||
    normalized.includes("számla");
  const wantsRetail =
    normalized.includes("retail") ||
    normalized.includes("inventory") ||
    normalized.includes("stock") ||
    normalized.includes("sku");

  const priceLine = `Pro: ${proLaunchPriceText}. Business: €${publicMonthlyPlanPrices.business}/month.`;

  if (language === "german") {
    if (unrelated)
      return "Ich bin auf UseClevr-Geschäftsdaten, Uploads, Credits, Berichte, Abrechnung und Analysen fokussiert. Dabei helfe ich dir gern.";
    if (wantsLanguages)
      return `Ja. Ich kann dir auf Englisch, Deutsch, Niederländisch, Spanisch, Ungarisch und Rumänisch helfen.`;
    if (wantsCapabilities)
      return "UseClevr hilft dir, CSV- und Excel-Dateien hochzuladen, Geschäftsdaten zu analysieren, Lagerprobleme zu erkennen, Umsatz und Marge auszuwerten, Rechnungen und Belege zu verarbeiten und Berichte als PDF oder Excel zu exportieren.";
    if (uploadBlocked) return buildUsyUploadCreditLimitAnswer(context);
    if (wantsCredits) return buildUsyCreditsExplanation(context);
    if (wantsPlan)
      return `Free eignet sich zum Testen. Pro passt für wachsende Unternehmen mit mehr Datensätzen und Analysekapazität. Business ist für Accounting AI, Rechnungs- und Belegverarbeitung sowie dedizierten Support. ${priceLine}`;
    if (wantsInvoices)
      return "Ja. Ich kann dir Invoice Processing, Receipt Processing, Billing und Abrechnungsfragen erklären. Business enthält Accounting AI sowie Rechnungs- und Belegverarbeitung.";
    if (wantsRetail)
      return "Ja. Ich kann Retail-Inventar analysieren: niedriger Bestand, Dead Stock, Top-Produkte, Margen, Umsatz und nächste Maßnahmen.";
    return "Ich kann auch allgemeine Fragen kurz beantworten, bin aber am besten für UseClevr-Datenanalyse, Uploads, Billing, Credits, Reports und Troubleshooting.";
  }

  if (language === "dutch") {
    if (unrelated)
      return "Ik ben gericht op UseClevr-bedrijfsdata, uploads, credits, rapporten, billing en analytics. Daar help ik je graag mee.";
    if (wantsLanguages)
      return `Ja. Ik kan helpen in Engels, Duits, Nederlands, Spaans, Hongaars en Roemeens.`;
    if (wantsCapabilities)
      return "UseClevr helpt je CSV- en Excel-bestanden te uploaden, bedrijfsdata te analyseren, voorraadproblemen te herkennen, omzet en marge te beoordelen, facturen en bonnetjes te verwerken en rapporten als PDF of Excel te exporteren.";
    if (uploadBlocked) return buildUsyUploadCreditLimitAnswer(context);
    if (wantsCredits) return buildUsyCreditsExplanation(context);
    if (wantsPlan)
      return `Free is om te testen. Pro is voor groeiende bedrijven met meer datasets en analysecapaciteit. Business is voor Accounting AI, factuur- en bonverwerking en dedicated support. ${priceLine}`;
    if (wantsInvoices)
      return "Ja. Ik kan helpen met invoice processing, receipt processing, billing en abonnementsvragen. Business bevat Accounting AI, factuurverwerking en bonverwerking.";
    if (wantsRetail)
      return "Ja. Ik kan retailvoorraad analyseren: lage voorraad, dead stock, topproducten, marges, omzet en aanbevolen acties.";
    return "Ik kan ook algemene vragen kort beantwoorden, maar ik ben vooral geoptimaliseerd voor UseClevr-data-analyse, uploads, billing, credits, rapporten en troubleshooting.";
  }

  if (language === "spanish") {
    if (unrelated)
      return "Estoy enfocada en datos empresariales de UseClevr, cargas, créditos, informes, facturación y analítica. Puedo ayudarte con esos temas.";
    if (wantsLanguages)
      return `Sí. Puedo ayudarte en inglés, alemán, neerlandés, español, húngaro y rumano.`;
    if (wantsCapabilities)
      return "UseClevr te ayuda a subir archivos CSV y Excel, analizar datos de negocio, detectar problemas de inventario, evaluar ingresos y margen, procesar facturas y recibos, y exportar informes en PDF o Excel.";
    if (uploadBlocked) return buildUsyUploadCreditLimitAnswer(context);
    if (wantsCredits) return buildUsyCreditsExplanation(context);
    if (wantsPlan)
      return `Free sirve para probar. Pro es para empresas en crecimiento con más datasets y capacidad de análisis. Business añade Accounting AI, procesamiento de facturas y recibos, y soporte dedicado. ${priceLine}`;
    if (wantsInvoices)
      return "Sí. Puedo ayudarte con procesamiento de facturas, recibos, billing y suscripción. Business incluye Accounting AI, invoice processing y receipt processing.";
    if (wantsRetail)
      return "Sí. Puedo analizar inventario retail: bajo stock, dead stock, productos principales, márgenes, ingresos y acciones recomendadas.";
    return "También puedo responder preguntas generales brevemente, pero estoy optimizada para análisis de datos, cargas, billing, créditos, informes y troubleshooting en UseClevr.";
  }

  if (language === "hungarian") {
    if (unrelated)
      return "Én a UseClevr üzleti adataira, feltöltésekre, kreditekre, riportokra, számlázásra és elemzésekre fókuszálok. Ezekben szívesen segítek.";
    if (wantsLanguages)
      return `Igen. Tudok segíteni angolul, németül, hollandul, spanyolul, magyarul és románul.`;
    if (wantsCapabilities)
      return "A UseClevr segít CSV és Excel fájlok feltöltésében, üzleti adatok elemzésében, készletproblémák felismerésében, bevétel- és árréselemzésben, számlák és nyugták feldolgozásában, valamint PDF vagy Excel riportok készítésében.";
    if (uploadBlocked) return buildUsyUploadCreditLimitAnswer(context);
    if (wantsCredits) return buildUsyCreditsExplanation(context);
    if (wantsPlan)
      return `A Free tesztelésre jó. A Pro növekvő vállalkozásoknak való több adatállománnyal és erősebb elemzéssel. A Business Accounting AI-t, számla- és nyugtafeldolgozást, valamint dedikált támogatást ad. ${priceLine}`;
    if (wantsInvoices)
      return "Igen. Tudok segíteni számlafeldolgozásban, nyugtafeldolgozásban, billingben és előfizetési kérdésekben. A Business tartalmazza az Accounting AI-t, invoice processinget és receipt processinget.";
    if (wantsRetail)
      return "Igen. Tudok retail készletet elemezni: alacsony készlet, dead stock, legjobb termékek, margin, bevétel és javasolt következő lépések.";
    return "Általános kérdésekre is röviden tudok válaszolni, de leginkább UseClevr adatelemzésre, feltöltésekre, billingre, kreditekre, riportokra és hibakeresésre vagyok optimalizálva.";
  }

  if (language === "romanian") {
    if (unrelated)
      return "Sunt concentrată pe date de business în UseClevr, uploaduri, credite, rapoarte, billing și analytics. Te pot ajuta cu aceste subiecte.";
    if (wantsLanguages)
      return `Da. Te pot ajuta în engleză, germană, neerlandeză, spaniolă, maghiară și română.`;
    if (wantsCapabilities)
      return "UseClevr te ajută să încarci fișiere CSV și Excel, să analizezi date de business, să identifici probleme de stoc, să evaluezi veniturile și marja, să procesezi facturi și chitanțe și să exporți rapoarte PDF sau Excel.";
    if (uploadBlocked) return buildUsyUploadCreditLimitAnswer(context);
    if (wantsCredits) return buildUsyCreditsExplanation(context);
    if (wantsPlan)
      return `Free este pentru testare. Pro este pentru afaceri în creștere, cu mai multe seturi de date și capacitate de analiză. Business adaugă Accounting AI, procesare de facturi și chitanțe, plus suport dedicat. ${priceLine}`;
    if (wantsInvoices)
      return "Da. Te pot ajuta cu procesarea facturilor, procesarea chitanțelor, billing și întrebări despre abonament. Business include Accounting AI, invoice processing și receipt processing.";
    if (wantsRetail)
      return "Da. Pot analiza inventarul retail: stoc scăzut, dead stock, produse performante, marje, venituri și acțiuni recomandate.";
    return "Pot răspunde pe scurt și la întrebări generale, dar sunt optimizată pentru analiza datelor UseClevr, uploaduri, billing, credite, rapoarte și troubleshooting.";
  }

  if (language === "english") {
    if (unrelated)
      return "I’m focused on UseClevr business data, uploads, credits, reports, billing, and analytics. I can help you with those topics.";
    if (wantsLanguages) return `Yes. I can help in ${supportedLanguageList}.`;
    if (wantsCapabilities)
      return "UseClevr helps you upload CSV and Excel files, analyze business data, detect inventory problems, evaluate revenue and margin, process invoices and receipts, and export reports as PDF or Excel.";
    if (uploadBlocked) return buildUsyUploadCreditLimitAnswer(context);
    if (wantsCredits) return buildUsyCreditsExplanation(context);
    if (wantsPlan)
      return `Free is for testing. Pro is for growing businesses with more datasets and analysis capacity. Business adds Accounting AI, invoice processing, receipt processing, and dedicated support. ${priceLine}`;
    if (wantsInvoices)
      return "Yes. I can help with invoice processing, receipt processing, billing, and subscription questions. Business includes Accounting AI, invoice processing, and receipt processing.";
    if (wantsRetail)
      return "Yes. I can analyze retail inventory, including low stock, dead stock, top products, margins, revenue, and recommended next actions.";
  }

  return null;
}

function buildFallbackAnswer(question: string, context: UsyContext) {
  const language = detectUsyLanguage(question);
  const localized = localizedFallbackAnswer(question, context, language);
  if (localized) return localized;

  const intent = detectIntent(question, context.role);
  if (intent) {
    return `${intent.answer(context)}\n\nNext step: ${nextStepForIntent(intent, context)}`;
  }

  if (!platformBrainRoles.includes(context.role) && detectIntent(question, "superadmin")) {
    return "That area is reserved for platform admins. I can help you with datasets, uploads, dashboards, reports, AI analysis, credits, billing, subscriptions, and Business Profile setup from your own workspace.";
  }

  return "I can help with UseClevr uploads, datasets, dashboards, AI analysis, forecasting, reports, billing, credits, Business Profile setup, integrations, and troubleshooting. Tell me what you are trying to do, and I will point you to the clearest next step.";
}

async function buildUsyAssistantResponse(question: string, context: UsyContext) {
  const language = detectUsyLanguage(question);
  const normalized = normalizeQuestion(question);
  const localAnswer = localizedFallbackAnswer(question, context, language);
  if (localAnswer) {
    return { answer: localAnswer, source: "knowledge" as const };
  }

  if (!isUseClevrDomainQuestion(normalized, context.role)) {
    return { answer: buildFallbackAnswer(question, context), source: "knowledge" as const };
  }

  try {
    return { answer: await askUsyAi(question, context), source: "ai" as const };
  } catch {
    return { answer: buildFallbackAnswer(question, context), source: "knowledge" as const };
  }
}

function nextStepForIntent(intent: UsyIntent, context: UsyContext) {
  if (intent.id === "pro-pricing" || intent.id === "pricing-general")
    return "open Billing Settings and choose Upgrade to Pro when you are ready.";
  if (intent.id === "business-pricing")
    return "open Billing Settings and choose Business if you need Accounting AI, document processing, and dedicated support.";
  if (intent.id.startsWith("admin-") && platformBrainRoles.includes(context.role))
    return "open the matching admin sidebar page and check the latest platform state there.";
  if (intent.id.includes("upload"))
    return "open Upload, try the file again, and check whether the message points to plan limits or file formatting.";
  if (intent.id === "forecast")
    return "check that your dataset includes a date column and a numeric business column such as revenue, sales, profit, quantity, or cost.";
  return "open the matching UseClevr area and I can help you decide what to check first.";
}

function getFollowUpSuggestions(question: string, answer: string, context: UsyContext) {
  const intent = detectIntent(`${question} ${answer}`, context.role);
  if (intent) return intent.followUps.slice(0, 5);
  return (
    platformBrainRoles.includes(context.role) ? platformBrainFollowUps : fallbackFollowUps
  ).slice(0, 5);
}

function roleFromAudience(audience: HelpChatboxAudience, sessionRole?: string | null): UsyRole {
  if (sessionRole === "superadmin" || audience === "superadmin") return "superadmin";
  if (sessionRole === "admin") return "admin";
  if (audience === "public") return "public";
  return "user";
}

function moduleNameFromPath(pathname: string) {
  if (pathname.includes("/admin/customers")) return "Customers admin";
  if (pathname.includes("/admin/levels")) return "Customer levels";
  if (pathname.includes("/admin/discounts")) return "Discount rules";
  if (pathname.includes("/admin/billing-settings")) return "Billing settings";
  if (pathname.includes("/admin/ai-traces")) return "AI traces";
  if (pathname.includes("/admin/ai-benchmarking")) return "AI benchmarking";
  if (pathname.includes("/admin/mcp-tokens")) return "MCP tokens";
  if (pathname.includes("/datasets")) return "Datasets";
  if (pathname.includes("/assistant")) return "AI Assistant";
  if (pathname.includes("/upload")) return "Upload";
  if (pathname.includes("/settings/billing")) return "Billing settings";
  if (pathname.includes("/settings")) return "Settings";
  if (pathname.includes("/dashboard") || pathname === "/app") return "Dashboard";
  if (pathname.includes("/business")) return "Business Profile";
  if (pathname.includes("/retail")) return "Retail Analytics";
  if (pathname.includes("/reports") || pathname.includes("/downloads"))
    return "Reports and Downloads";
  return pathname === "/" ? "Public homepage" : pathname;
}

function SuggestionChip({
  label,
  index,
  onClick,
  compact = false,
}: {
  label: string;
  index: number;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group rounded-2xl border text-left font-semibold text-white transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200",
        "bg-[linear-gradient(135deg,rgba(34,211,238,0.15),rgba(216,180,254,0.12))] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
        "hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(34,211,238,0.16),0_0_20px_rgba(216,180,254,0.1)]",
        compact ? "px-3 py-1.5 text-xs" : "px-3.5 py-2.5 text-sm",
        index % 2 === 0
          ? "border-cyan-200/35 hover:border-cyan-100/75 hover:bg-cyan-200/[0.16]"
          : "border-fuchsia-200/30 hover:border-fuchsia-100/70 hover:bg-fuchsia-200/[0.14]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function UsyLanguageBadge({
  language,
  visible,
  showHint,
  onHintChange,
}: {
  language: (typeof usyLanguageBadges)[number];
  visible: boolean;
  showHint: boolean;
  onHintChange: (show: boolean) => void;
}) {
  return (
    <div className="relative mt-2 inline-flex">
      <button
        type="button"
        onClick={() => onHintChange(!showHint)}
        onMouseEnter={() => onHintChange(true)}
        onMouseLeave={() => onHintChange(false)}
        onFocus={() => onHintChange(true)}
        onBlur={() => onHintChange(false)}
        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-cyan-200/25 bg-cyan-200/[0.08] px-2.5 py-1 text-[11px] font-medium leading-none text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_18px_rgba(34,211,238,0.08)] transition hover:border-cyan-100/55 hover:bg-cyan-100/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
        aria-label="Usy multilingual support"
      >
        <span aria-hidden="true">🌍</span>
        <span>Multilingual</span>
        <span className="text-cyan-200/70" aria-hidden="true">
          •
        </span>
        <span
          key={language.label}
          className={[
            "inline-flex min-w-[6.25rem] items-center gap-1 transition duration-300 ease-out motion-reduce:transition-none",
            visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
          ].join(" ")}
        >
          <span aria-hidden="true">{language.flag}</span>
          <span>{language.label}</span>
        </span>
      </button>
      {showHint && (
        <div className="absolute left-0 top-[calc(100%+0.45rem)] z-20 w-56 rounded-2xl border border-cyan-100/20 bg-slate-950/95 px-3 py-2 text-xs leading-5 text-slate-100 shadow-[0_18px_48px_rgba(2,6,23,0.42),0_0_22px_rgba(34,211,238,0.12)] backdrop-blur-xl">
          Usy automatically replies in the language you use.
        </div>
      )}
    </div>
  );
}

function buildUsySystemPrompt(context: UsyContext) {
  const moduleName = moduleNameFromPath(context.route);
  const usageText = context.usage?.unlimited
    ? `Analyst usage: ${context.usage.unlimitedLabel || "Unlimited"}.`
    : typeof context.usage?.analysisCount === "number" && typeof context.usage?.total === "number"
      ? `Analyst usage: ${context.usage.analysisCount}/${context.usage.total} included credits used.`
      : "Analyst usage: unknown.";

  return [
    "You are Usy, the official AI Business Intelligence Assistant of UseClevr.",
    "Be warm, concise, professional, calm, trustworthy, and practical.",
    "Answer the user's actual message, including short or messy messages.",
    `Detect the user's language and respond in that language when possible. Supported languages: ${supportedLanguageList}.`,
    `If asked whether you speak other languages, answer clearly: "Yes. I can help in ${supportedLanguageList}."`,
    `Current route: ${context.route}. Current module: ${moduleName}. Current user role: ${context.role}. Current plan: ${context.plan || "unknown"}. ${usageText}`,
    `Current pricing: Pro launch pricing is ${proLaunchPriceText}. Business is €${publicMonthlyPlanPrices.business}/month.`,
    "Do not mention annual pricing unless UseClevr explicitly provides it in the current prompt.",
    "Normal users can receive help only with their own datasets, uploads, dashboards, reports, AI analysis, credits, billing, subscription, and Business Profile.",
    "Admins and superadmins can use Usy as UseClevr Company Brain Lite for customers, plans, credits, uploads, errors, failed analyses, AI traces, billing settings, discount rules, MCP tokens, user issues, platform status, and usage monitoring.",
    "UseClevr skills: CSV and Excel uploads, datasets, AI credits, upload limits, Free/Pro/Business plan limits, Retail analysis, Accountancy analysis, invoice processing, receipt processing, reports, downloads, billing, subscription, business profile, troubleshooting, and upgrade flow.",
    `If upload credits are exhausted, answer deterministically: ${buildUploadCreditLimitCopy({ used: context.usage?.analysisCount, limit: context.usage?.total }).title}. ${buildUploadCreditLimitCopy({ used: context.usage?.analysisCount, limit: context.usage?.total }).inlineMessage}`,
    "Never describe upload blocking as probable or uncertain. Never suggest deleting or removing datasets to restore upload credits.",
    "Stay focused on UseClevr and business data workflows. Do not behave like a general-purpose chatbot.",
    "If the question is outside UseClevr, politely decline in the user's language and redirect back to UseClevr business data, uploads, credits, reports, billing, and analytics.",
    "Never expose platform-brain or admin guidance to normal users. Never hallucinate private customer data, dataset values, secrets, API keys, or hidden account state.",
    "If exact private data is needed, tell the user where to check inside UseClevr instead of inventing it.",
    "Give a useful next step. Ask a clarifying question only when needed.",
  ].join("\n");
}

async function askUsyAi(question: string, context: UsyContext) {
  const response = await fetch("/api/hybrid-ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content: buildUsySystemPrompt(context),
        },
        { role: "user", content: question },
      ],
    }),
  });

  if (!response.ok) throw new Error("Usy AI endpoint is unavailable.");
  const result = await response.json();
  const answer =
    typeof result.answer === "string"
      ? result.answer
      : typeof result.content === "string"
        ? result.content
        : "";
  if (!answer.trim()) throw new Error("Usy AI returned an empty answer.");
  return answer.trim();
}

function UsyAvatar({
  size = "lg",
  interactive = false,
}: {
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
}) {
  const dimensions = size === "sm" ? "h-14 w-14" : size === "md" ? "h-16 w-16" : "h-24 w-24";
  const imageSize = size === "sm" ? 56 : size === "md" ? 64 : 96;

  return (
    <div
      className={[
        "usy-avatar-glow relative isolate shrink-0 rounded-full",
        dimensions,
        interactive
          ? "transition duration-300 group-hover:-translate-y-0.5 group-hover:scale-[1.03]"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      <div className="absolute inset-0 z-[1] rounded-full bg-gradient-to-br from-cyan-200 via-sky-300 to-fuchsia-300 p-[2px] shadow-[0_0_26px_rgba(34,211,238,0.3),0_0_34px_rgba(168,85,247,0.18)]">
        <div className="relative h-full w-full overflow-hidden rounded-full bg-slate-950">
          <Image
            src={usyAvatar}
            alt=""
            width={imageSize}
            height={imageSize}
            className="h-full w-full scale-110 object-cover object-top"
            priority={false}
          />
          <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_15%,rgba(255,255,255,0.28),transparent_34%),linear-gradient(145deg,transparent_45%,rgba(34,211,238,0.16))]" />
        </div>
      </div>
    </div>
  );
}

export function HelpChatbox({
  audience = "public",
  hideOnApp = false,
  userRole,
}: {
  audience?: HelpChatboxAudience;
  hideOnApp?: boolean;
  userRole?: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [usage, setUsage] = useState<UsyUsageContext | null>(null);
  const [languageBadgeIndex, setLanguageBadgeIndex] = useState(0);
  const [languageBadgeVisible, setLanguageBadgeVisible] = useState(true);
  const [showLanguageHint, setShowLanguageHint] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener("toggle-help-chat", openChat);
    return () => window.removeEventListener("toggle-help-chat", openChat);
  }, []);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isAsking]);

  useEffect(() => {
    if (!open) {
      setShowLanguageHint(false);
      return;
    }

    let fadeTimeout: number | null = null;
    const interval = window.setInterval(() => {
      setLanguageBadgeVisible(false);
      fadeTimeout = window.setTimeout(() => {
        setLanguageBadgeIndex((current) => (current + 1) % usyLanguageBadges.length);
        setLanguageBadgeVisible(true);
      }, 220);
    }, 2000);

    return () => {
      window.clearInterval(interval);
      if (fadeTimeout !== null) window.clearTimeout(fadeTimeout);
    };
  }, [open]);

  useEffect(() => {
    if (!open || audience === "public") return;
    let cancelled = false;

    fetch("/api/usage")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: UsyUsageContext | null) => {
        if (!cancelled) setUsage(data);
      })
      .catch(() => {
        if (!cancelled) setUsage(null);
      });

    return () => {
      cancelled = true;
    };
  }, [audience, open]);

  if (hideOnApp && pathname.startsWith("/app")) {
    return null;
  }

  function currentUsyContext(): UsyContext {
    const role = roleFromAudience(audience, userRole);
    return {
      audience,
      role,
      route: pathname,
      plan:
        usage?.subscriptionTier ||
        (role === "superadmin" ? "superadmin" : role === "admin" ? "admin" : undefined),
      usage,
    };
  }

  async function submitQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isAsking) return;

    const context = currentUsyContext();
    setQuery("");
    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    setIsAsking(true);

    try {
      const { answer, source } = await buildUsyAssistantResponse(trimmed, context);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: answer,
          source,
          followUps: getFollowUpSuggestions(trimmed, answer, context),
        },
      ]);
    } finally {
      setIsAsking(false);
    }
  }

  function handleQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitQuestion(query);
  }

  const containerClassName =
    "fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] right-4 z-[139] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 sm:bottom-[calc(env(safe-area-inset-bottom,0px)+2rem)] sm:right-6";
  const panelClassName = [
    "usy-panel-open fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] top-6 flex max-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-[30px] border border-cyan-200/25 bg-slate-950/[0.95] text-white shadow-[0_34px_100px_rgba(8,13,30,0.6),0_0_52px_rgba(34,211,238,0.16)] backdrop-blur-2xl sm:absolute sm:bottom-24 sm:top-auto sm:inset-x-auto sm:h-auto sm:max-h-[calc(100vh-8rem)] sm:w-[min(calc(100vw-2rem),520px)]",
    "sm:right-0",
  ].join(" ");

  return (
    <div className={containerClassName}>
      {open && (
        <section className={panelClassName} aria-label="Usy chat assistant">
          <header className="relative shrink-0 overflow-visible border-b border-cyan-200/18 bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,0.24),transparent_34%),radial-gradient(circle_at_86%_0%,rgba(216,180,254,0.22),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.99),rgba(17,24,39,0.94))] px-5 py-4 sm:px-6">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200 to-fuchsia-200/80" />
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold leading-tight tracking-tight">Usy</h2>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-300/[0.12] px-2.5 py-1 text-[11px] font-medium leading-none text-emerald-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)]" />
                    Online
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm text-cyan-50/[0.82]">
                  UseClevr AI Business Assistant
                </p>
                <UsyLanguageBadge
                  language={usyLanguageBadges[languageBadgeIndex]}
                  visible={languageBadgeVisible}
                  showHint={showLanguageHint}
                  onHintChange={setShowLanguageHint}
                />
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-full border border-white/10 bg-white/[0.08] p-2 text-white/70 transition hover:bg-white/[0.14] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                aria-label="Close Usy chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <main
            ref={transcriptRef}
            className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-4 py-4 sm:px-5 sm:py-5"
          >
            {messages.length === 0 ? (
              <div className="flex min-h-full flex-col gap-4">
                <div className="relative overflow-hidden rounded-[28px] border border-cyan-200/16 bg-[linear-gradient(145deg,rgba(255,255,255,0.12),rgba(255,255,255,0.048))] px-5 py-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_18px_60px_rgba(2,6,23,0.22)] sm:px-6">
                  <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/80 to-transparent" />
                  <div className="flex justify-center">
                    <UsyAvatar />
                  </div>
                  <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-cyan-200/30 bg-cyan-200/10 px-3 py-1 text-xs font-medium text-cyan-50">
                    <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.9)]" />
                    Always here to help
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight sm:text-[1.7rem]">
                    Hi, I'm Usy 👋
                  </h3>
                  <p className="mt-1.5 text-sm font-medium text-cyan-50">
                    Your AI Business Intelligence Assistant.
                  </p>
                  <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-200/[0.88]">
                    I'm here to help you understand your data, analyze your business, discover
                    opportunities, explain dashboards, generate insights, and answer anything about
                    UseClevr.
                  </p>
                </div>

                <div>
                  <p className="mb-2.5 text-sm font-semibold text-slate-100">
                    What can I help you with today?
                  </p>
                  <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                    {starterSuggestions.map((suggestion, index) => (
                      <SuggestionChip
                        key={suggestion}
                        label={suggestion}
                        index={index}
                        onClick={() => submitQuestion(suggestion)}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/[0.052] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100/[0.85]">
                    <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
                    Usy can help with
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {capabilities.map((capability) => (
                      <span
                        key={capability}
                        className="rounded-full border border-cyan-100/10 bg-slate-900/75 px-2.5 py-1 text-[11px] text-slate-200"
                      >
                        {capability}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pb-1">
                {messages.map((message, index) => {
                  const showFollowUps =
                    message.role === "assistant" &&
                    index === messages.length - 1 &&
                    Array.isArray(message.followUps) &&
                    message.followUps.length > 0 &&
                    !isAsking;

                  return (
                    <div
                      key={`${message.role}-${index}`}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div className="max-w-[90%] space-y-2 sm:max-w-[86%]">
                        <div
                          className={`whitespace-pre-line rounded-3xl px-4 py-3 text-sm leading-6 ${
                            message.role === "user"
                              ? "rounded-br-lg bg-gradient-to-br from-cyan-200 via-sky-200 to-fuchsia-200 text-slate-950 shadow-[0_16px_38px_rgba(34,211,238,0.18)]"
                              : "rounded-bl-lg border border-cyan-100/15 bg-white/[0.086] text-slate-50 shadow-[inset_3px_0_0_rgba(34,211,238,0.58),0_16px_38px_rgba(2,6,23,0.18)] backdrop-blur"
                          }`}
                        >
                          {message.role === "assistant" && (
                            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100/80">
                              <Bot className="h-3 w-3" />
                              Usy
                            </div>
                          )}
                          {message.text}
                        </div>
                        {showFollowUps && (
                          <div className="flex flex-wrap gap-2 pl-1">
                            {message.followUps?.map((followUp, followUpIndex) => (
                              <SuggestionChip
                                key={followUp}
                                label={followUp}
                                index={followUpIndex}
                                onClick={() => submitQuestion(followUp)}
                                compact
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {isAsking && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-3xl border border-cyan-100/15 bg-white/[0.085] px-4 py-3 text-sm text-slate-100 shadow-[inset_3px_0_0_rgba(34,211,238,0.62)]">
                      <Loader2 className="h-4 w-4 animate-spin text-cyan-200" />
                      Usy is thinking...
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>

          <form
            className="shrink-0 border-t border-cyan-100/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(8,13,30,0.98))] p-3 sm:p-4"
            onSubmit={handleQuestion}
          >
            <div className="rounded-[22px] border border-cyan-200/[0.2] bg-white/[0.08] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_18px_46px_rgba(2,6,23,0.2)] focus-within:border-cyan-200/70 focus-within:shadow-[0_0_0_1px_rgba(34,211,238,0.22),0_20px_56px_rgba(34,211,238,0.13)]">
              <textarea
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submitQuestion(query);
                  }
                }}
                placeholder="Ask Usy anything about your business..."
                rows={1}
                className="max-h-24 min-h-9 w-full resize-none bg-transparent px-2 py-1.5 text-sm leading-5 text-white placeholder:text-slate-400 focus:outline-none"
              />
              <div className="flex items-center justify-between gap-3 px-1 pb-0.5">
                <span className="text-[11px] text-slate-400">Powered by UseClevr Hybrid AI</span>
                <Button
                  type="submit"
                  size="icon"
                  disabled={!query.trim() || isAsking}
                  className="h-9 w-9 rounded-full bg-gradient-to-br from-cyan-200 via-sky-200 to-fuchsia-200 text-slate-950 shadow-[0_0_22px_rgba(34,211,238,0.28)] hover:opacity-95"
                  aria-label="Send message to Usy"
                >
                  {isAsking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="usy-launcher group relative inline-flex h-16 w-16 items-center justify-center rounded-full text-white transition duration-300 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        aria-label={open ? "Close Usy chat" : "Ask Usy"}
        aria-expanded={open}
        title="Ask Usy"
      >
        <span className="usy-launcher-bubble pointer-events-none absolute bottom-full right-0 mb-4 w-56 rounded-2xl border border-cyan-200/25 bg-slate-950/[0.88] px-4 py-3 text-left text-sm font-semibold leading-5 text-cyan-50 opacity-0 shadow-[0_20px_54px_rgba(8,13,30,0.42),0_0_30px_rgba(34,211,238,0.16)] backdrop-blur-xl transition duration-200 ease-out before:absolute before:-bottom-1.5 before:right-6 before:h-3 before:w-3 before:rotate-45 before:border-b before:border-r before:border-cyan-200/25 before:bg-slate-950/[0.88] group-hover:pointer-events-auto group-hover:translate-y-[-4px] group-hover:opacity-100 group-focus-visible:pointer-events-auto group-focus-visible:translate-y-[-4px] group-focus-visible:opacity-100">
          How can I help you today!?
        </span>
        <UsyAvatar size="sm" interactive />
      </button>
    </div>
  );
}
