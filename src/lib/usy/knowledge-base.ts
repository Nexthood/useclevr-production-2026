import {
  billingPlans,
  publicMonthlyPlanPrices,
} from "@/lib/billing/plans";
import {
  proMarketByCurrency,
  resolvePlanPrice,
  type SupportedCurrency,
} from "@/lib/billing/launch-pricing";
import { FEATURE_CREDIT_COSTS } from "@/lib/billing/feature-costs";
import { allowedUploadDatasetCategories } from "@/lib/data/dataset-category";
import { STANDARD_UPLOAD_FORMAT_EXTENSIONS } from "@/lib/upload/upload-security";
import type { SupportedUsyLanguage, UsyContactCategory } from "@/lib/usy/types";

export const supportedUsyCurrencies: SupportedCurrency[] = ["EUR", "GBP", "USD", "CAD"];

export const supportedUsyLanguages: SupportedUsyLanguage[] = [
  "english",
  "german",
  "dutch",
  "french",
  "spanish",
  "hungarian",
  "romanian",
  "swedish",
];

export const supportedUsyLanguageLabel = "English, German, Dutch, French, Spanish, Hungarian, Romanian, and Swedish";

export const usyContactCategories: UsyContactCategory[] = [
  "sales",
  "technical_support",
  "billing",
  "management",
  "executive",
];

export const usyProductFacts = {
  productName: "UseClevr",
  uploadFormats: [...STANDARD_UPLOAD_FORMAT_EXTENSIONS],
  uploadDatasetTypes: [...allowedUploadDatasetCategories],
  persistentDisclaimer: "UseClevr AI can make mistakes. Verify important business and financial information.",
  routes: {
    upload: "/app/upload",
    datasets: "/app/datasets",
    dashboard: "/app",
    assistant: "/app/assistant",
    reports: "/app/reports",
    billing: "/app/settings/billing",
    account: "/app/settings",
    business: "/app/business",
    retail: "/app/retail",
    accountancy: "/app/accountancy",
    governance: "/app/ai-governance",
    aiTraces: "/app/admin/ai-traces",
    aiBenchmarking: "/app/admin/ai-benchmarking",
    aiCostOptimizer: "/app/admin/ai-cost-optimizer",
    integrations: "/app/retail/integrations",
  },
  contactDepartments: {
    sales: "Sales",
    technical_support: "Technical Support / IT",
    billing: "Billing",
    management: "Management",
    executive: "Executive Management",
  } satisfies Record<UsyContactCategory, string>,
} as const;

export const usyClevrSyncFacts = {
  accessRules: {
    free: "ClevrSync is not available on Free.",
    pro: "ClevrSync is enabled on Pro.",
    business: "ClevrSync is enabled on Business.",
    superadmin: "ClevrSync is enabled for superadmins regardless of subscription.",
  },
  connectors: [
    { name: "Google Sheets", status: "available" as const },
  ],
  oneDriveSharePointNotPartOfProduct: "OneDrive and SharePoint are not part of the product.",
  localFilesAreNotConnectors:
    "Excel and CSV files can be uploaded directly through UseClevr. ClevrSync is used for connecting external data sources such as Google Sheets.",
  googleSheetsFlow: [
    "Connect Google",
    "Select spreadsheet",
    "Select worksheet",
    "Preview",
    "Connect & Analyze",
    "UseClevr creates or updates the dataset",
    "Analysis opens for the selected dataset",
  ],
  manualUrlEntryFallback: "Manual Google Sheet URL entry is only a fallback when discovery does not list the spreadsheet.",
  discoveryPreviewCredits:
    "ClevrSync discovery and preview do not consume analysis credits; credits are charged when a connection runs Connect & Analyze.",
} as const;

export const usyDatasetIsolationFacts = {
  selectedDatasetOnly:
    "UseClevr analysis and generated reports for a selected dataset use only that dataset.",
  noCrossDatasetAggregation:
    "Dashboard and report metrics are never automatically aggregated across all datasets when a specific dataset is selected.",
  provenance:
    "Reports identify the calculation basis as selected dataset only, include rows analyzed, and keep dataset-specific calculations and provenance.",
} as const;

export const usyReportFacts = {
  sections: [
    "Executive Summary",
    "Revenue",
    "Orders",
    "AOV",
    "Customers",
    "Units Sold",
    "Products",
    "COGS",
    "Gross Profit",
    "Gross Margin",
    "Revenue trends",
    "Category performance",
    "Product performance",
    "Customer metrics",
    "Geography",
    "Business Balanced Scorecard",
    "Recommendations",
    "Data confidence",
    "Provenance",
    "Results Summary",
    "Missing-data disclosure",
  ],
  supportedMetricsOnly:
    "Metrics are only presented when the dataset supports them.",
  missingDataDisclosure:
    "Missing information stays explicitly unavailable instead of being invented; for example, Return Rate is marked unavailable when return values cannot be normalized reliably.",
} as const;

export const usyRetailProfitabilityFacts = {
  revenue: "Revenue maps to the source revenue field.",
  cost: "Cost maps to COGS when valid retail-sales semantics are established.",
  profit: "Profit maps to Gross Profit when valid retail-sales semantics are established.",
  grossMargin: "Gross Margin is derived from valid Revenue/COGS/Profit inputs.",
  noExampleValues:
    "Usy explains the mapping rules without hardcoding example values from any specific dataset.",
} as const;

export const usyCreditCostFacts = {
  uploadWithStandardAnalysis: FEATURE_CREDIT_COSTS.STANDARD_UPLOAD_ANALYSIS,
  aiAssistantMessage: FEATURE_CREDIT_COSTS.AI_ANALYST_MESSAGE,
  reportGeneration: FEATURE_CREDIT_COSTS.REPORT_GENERATION,
  forecast: FEATURE_CREDIT_COSTS.FORECAST,
  profitabilityAnalysis: FEATURE_CREDIT_COSTS.PROFITABILITY_ANALYSIS,
  existingReportDownload: FEATURE_CREDIT_COSTS.EXISTING_REPORT_DOWNLOAD,
  bundledOperationsNote:
    "Internal processing that belongs to the same bundled operation is not charged as an additional user cost.",
} as const;

export function normalizeUsyCurrency(currency?: string | null): SupportedCurrency | null {
  const normalized = currency?.trim().toUpperCase();
  return normalized && (supportedUsyCurrencies as string[]).includes(normalized)
    ? (normalized as SupportedCurrency)
    : null;
}

function monthlyPriceTextForMarket(
  planId: "pro_monthly" | "business_monthly",
  currency: SupportedCurrency,
): string | null {
  const market = proMarketByCurrency[currency];
  const resolved = resolvePlanPrice(planId, market, "monthly");
  return resolved?.displayPrice ?? null;
}

export function getPlanSummary(currency?: string | null) {
  const free = billingPlans.find((plan) => plan.id === "free");
  const pro = billingPlans.find((plan) => plan.id === "pro_monthly");
  const business = billingPlans.find((plan) => plan.id === "business_monthly");
  const resolvedCurrency = normalizeUsyCurrency(currency) ?? "EUR";

  return {
    currency: resolvedCurrency,
    free: {
      name: free?.name ?? "Free",
      monthlyCredits: free?.limits.monthlyCredits ?? 2,
      monthlyPrice: free?.price ?? 0,
      maxDatasets: free?.limits.maxDatasets ?? 2,
      maxFileSizeMb: free?.limits.maxFileSizeMb ?? 10,
      clevrSyncEnabled: false,
      topUpsEnabled: false,
      features: free?.features ?? [],
    },
    pro: {
      name: pro?.name ?? "Pro",
      priceText: monthlyPriceTextForMarket("pro_monthly", resolvedCurrency)
        ?? `€${publicMonthlyPlanPrices.pro}/month`,
      monthlyPrice: pro?.price ?? 40,
      monthlyCredits: pro?.limits.monthlyCredits ?? 500,
      maxDatasets: pro?.limits.maxDatasets ?? 25,
      maxFileSizeMb: pro?.limits.maxFileSizeMb ?? 100,
      clevrSyncEnabled: true,
      topUpsEnabled: true,
      features: pro?.features ?? [],
    },
    business: {
      name: business?.name ?? "Business",
      priceText: monthlyPriceTextForMarket("business_monthly", resolvedCurrency)
        ?? `€${publicMonthlyPlanPrices.business}/month`,
      monthlyPrice: business?.price ?? 420,
      monthlyCredits: business?.limits.monthlyCredits ?? 1500,
      maxDatasets: business?.limits.maxDatasets ?? 100,
      maxFileSizeMb: business?.limits.maxFileSizeMb ?? 500,
      clevrSyncEnabled: true,
      topUpsEnabled: true,
      features: business?.features ?? [],
    },
    superadmin: {
      name: "Superadmin",
      clevrSyncEnabled: true,
    },
  };
}

export type UsyPlanSummary = ReturnType<typeof getPlanSummary>;

export const usyAgentPassportAnswers: Record<SupportedUsyLanguage, string> = {
  english: "Agent Trust Passport records the Clevr AI Analyst's stable identity, accountable human owner, purpose, declared scope, owner-declared risk, and descriptive lifecycle. Signed-in users manage their own passport and view linked new analyst traces in AI Governance → Transparency. Historical traces stay unassigned, and Eclipse Mode requests are not stored. Lifecycle and risk declarations do not enforce runtime restrictions, grant permissions, verify identity, or constitute security certification. Usy explains this feature without reading or editing your passport. Businesses use it to document accountability and review declared AI use. The identity persists within your account across provider and model changes. Create or view it in AI Governance → Transparency → Agent Trust Passport. Risk labels (unclassified, low, medium, high) and lifecycle labels (draft, active, retired) are owner declarations, not automatic assessments. It does not guarantee regulatory compliance.",
  german: "Agent Trust Passport dokumentiert die stabile Identität des Clevr AI Analyst, die verantwortliche Person, den Zweck, den erklärten Umfang, das vom Eigentümer erklärte Risiko und den beschreibenden Lebenszyklus. Angemeldete Nutzer verwalten ihren eigenen Pass und sehen verknüpfte neue Analyst-Traces unter AI Governance → Transparency. Historische Traces bleiben ohne Zuordnung; Anfragen im Eclipse Mode werden nicht gespeichert. Lebenszyklus und Risikoangaben erzwingen keine Laufzeitbeschränkungen, erteilen keine Berechtigungen, bestätigen keine Identität und sind keine Sicherheitszertifizierung. Usy erklärt diese Funktion, ohne deinen Pass zu lesen oder zu bearbeiten. Unternehmen dokumentieren damit Verantwortlichkeit und den erklärten KI-Einsatz. Die Identität bleibt innerhalb deines Kontos über Anbieter- und Modellwechsel hinweg bestehen. Erstelle oder öffne den Pass unter AI Governance → Transparency → Agent Trust Passport. Risikostufen (unclassified, low, medium, high) und Lebenszykluswerte (draft, active, retired) sind Angaben des Eigentümers, keine automatischen Bewertungen. Der Pass garantiert keine regulatorische Konformität.",
  dutch: "Agent Trust Passport legt de vaste identiteit van de Clevr AI Analyst, de verantwoordelijke persoon, het doel, de opgegeven reikwijdte, het door de eigenaar opgegeven risico en de beschrijvende levenscyclus vast. Ingelogde gebruikers beheren hun eigen paspoort en bekijken gekoppelde nieuwe analisttraces onder AI Governance → Transparency. Historische traces blijven ongekoppeld; verzoeken in Eclipse Mode worden niet opgeslagen. Levenscyclus en risicoverklaringen dwingen geen runtimebeperkingen af, verlenen geen rechten, verifiëren geen identiteit en vormen geen beveiligingscertificering. Usy legt deze functie uit zonder je paspoort te lezen of te wijzigen. Bedrijven documenteren hiermee verantwoordelijkheid en opgegeven AI-gebruik. De identiteit blijft binnen je account bestaan bij wijzigingen van aanbieder of model. Maak of bekijk het paspoort onder AI Governance → Transparency → Agent Trust Passport. Risicolabels (unclassified, low, medium, high) en levenscycluslabels (draft, active, retired) zijn verklaringen van de eigenaar, geen automatische beoordelingen. Het paspoort garandeert geen naleving van regelgeving.",
  french: "Agent Trust Passport décrit l’identité stable de Clevr AI Analyst, le responsable humain, l’objectif, le périmètre déclaré, le risque déclaré par le propriétaire et le cycle de vie descriptif. Les utilisateurs connectés gèrent leur propre passeport et consultent les nouvelles traces liées dans AI Governance → Transparency. Les traces historiques restent sans attribution ; les requêtes Eclipse Mode ne sont pas enregistrées. Le cycle de vie et les déclarations de risque n’imposent aucune restriction d’exécution, n’accordent aucune autorisation, ne vérifient aucune identité et ne constituent aucune certification de sécurité. Usy explique cette fonction sans lire ni modifier votre passeport. Les entreprises documentent ainsi la responsabilité et l’usage déclaré de l’IA. L’identité persiste dans votre compte lors des changements de fournisseur ou de modèle. Créez ou consultez le passeport dans AI Governance → Transparency → Agent Trust Passport. Les niveaux de risque (unclassified, low, medium, high) et les statuts (draft, active, retired) sont déclarés par le propriétaire, sans évaluation automatique. Le passeport ne garantit pas la conformité réglementaire.",
  spanish: "Agent Trust Passport registra la identidad estable de Clevr AI Analyst, la persona responsable, el propósito, el alcance declarado, el riesgo declarado por el propietario y el ciclo de vida descriptivo. Los usuarios con sesión iniciada gestionan su propio pasaporte y consultan las nuevas trazas vinculadas en AI Governance → Transparency. Las trazas históricas quedan sin asignar; las solicitudes de Eclipse Mode no se almacenan. El ciclo de vida y las declaraciones de riesgo no imponen restricciones de ejecución, no otorgan permisos, no verifican la identidad ni constituyen una certificación de seguridad. Usy explica esta función sin leer ni editar tu pasaporte. Las empresas lo usan para documentar responsabilidades y el uso declarado de IA. La identidad persiste dentro de tu cuenta al cambiar de proveedor o modelo. Crea o consulta el pasaporte en AI Governance → Transparency → Agent Trust Passport. Los niveles de riesgo (unclassified, low, medium, high) y los estados (draft, active, retired) son declaraciones del propietario, no evaluaciones automáticas. El pasaporte no garantiza el cumplimiento normativo.",
  hungarian: "Az Agent Trust Passport rögzíti a Clevr AI Analyst állandó azonosítóját, felelős emberi tulajdonosát, célját, deklarált hatókörét, a tulajdonos által megadott kockázatot és a leíró életciklust. A bejelentkezett felhasználók az AI Governance → Transparency alatt kezelik saját útlevelüket és tekintik meg az új, kapcsolt elemzői nyomokat. A korábbi nyomok hozzárendelés nélkül maradnak; az Eclipse Mode kérései nem kerülnek tárolásra. Az életciklus és a kockázati nyilatkozat nem kényszerít ki futásidejű korlátozást, nem ad jogosultságot, nem igazol személyazonosságot és nem jelent biztonsági tanúsítást. Usy a funkciót magyarázza el, az útleveledet nem olvassa és nem módosítja. A vállalkozások ezzel dokumentálják a felelősséget és a deklarált AI-használatot. Az azonosító a fiókon belül szolgáltató- és modellváltáskor is állandó. Az útlevelet az AI Governance → Transparency → Agent Trust Passport alatt hozhatod létre és tekintheted meg. A kockázati szintek (unclassified, low, medium, high) és az életciklusértékek (draft, active, retired) tulajdonosi nyilatkozatok, nem automatikus értékelések. Az útlevél nem garantál jogszabályi megfelelést.",
  romanian: "Agent Trust Passport înregistrează identitatea stabilă a Clevr AI Analyst, persoana responsabilă, scopul, domeniul declarat, riscul declarat de proprietar și ciclul de viață descriptiv. Utilizatorii autentificați își gestionează propriul pașaport și consultă noile urme asociate în AI Governance → Transparency. Urmele istorice rămân neatribuite; cererile Eclipse Mode nu sunt stocate. Ciclul de viață și declarațiile de risc nu impun restricții de execuție, nu acordă permisiuni, nu verifică identitatea și nu constituie certificare de securitate. Usy explică funcția fără să citească sau să modifice pașaportul tău. Companiile îl folosesc pentru a documenta responsabilitatea și utilizarea declarată a AI. Identitatea persistă în cont la schimbarea furnizorului sau modelului. Creează sau consultă pașaportul în AI Governance → Transparency → Agent Trust Passport. Nivelurile de risc (unclassified, low, medium, high) și stările (draft, active, retired) sunt declarații ale proprietarului, nu evaluări automate. Pașaportul nu garantează conformitatea cu reglementările.",
  swedish: "Agent Trust Passport dokumenterar Clevr AI Analysts stabila identitet, ansvariga mänskliga ägare, syfte, deklarerade omfattning, ägarens deklarerade risk och beskrivande livscykel. Inloggade användare hanterar sitt eget pass och ser nya länkade analysspår under AI Governance → Transparency. Historiska spår förblir utan koppling; förfrågningar i Eclipse Mode lagras inte. Livscykeln och riskdeklarationerna tillämpar inga körningsbegränsningar, ger inga behörigheter, verifierar ingen identitet och utgör ingen säkerhetscertifiering. Usy förklarar funktionen utan att läsa eller ändra ditt pass. Företag använder det för att dokumentera ansvar och deklarerad AI-användning. Identiteten består inom kontot vid byte av leverantör eller modell. Skapa eller visa passet under AI Governance → Transparency → Agent Trust Passport. Risknivåer (unclassified, low, medium, high) och livscykelvärden (draft, active, retired) är ägarens deklarationer, inte automatiska bedömningar. Passet garanterar inte regelefterlevnad.",
};
