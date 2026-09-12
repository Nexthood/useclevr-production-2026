import {
  LEGAL_STRUCTURES,
  TAX_TYPES,
  type CompanySetupPayload,
  type LegalStructure,
  type TaxType,
} from "@/lib/business/company-setup";

export type AccountingContext = {
  source: "business_profile";
  country: string | null;
  currency: string | null;
  legalStructure: string | null;
  taxSystem: string | null;
  vatRegistered: boolean | null;
  defaultVatRate: number | null;
  fiscalPeriod: string | null;
  businessType: string | null;
  industry: string | null;
};

const legalStructureLabels = new Map<LegalStructure, string>(
  LEGAL_STRUCTURES.map((option) => [option.value, option.label]),
);

const taxTypeLabels = new Map<TaxType, string>(
  TAX_TYPES.map((option) => [option.value, option.label]),
);

export function getAccountingContext(setup: CompanySetupPayload | null | undefined): AccountingContext {
  const taxEntries = Array.isArray(setup?.taxSettings.taxEntries) ? setup.taxSettings.taxEntries : [];
  const taxType = firstText(setup?.taxSettings.taxType);
  const taxSystem = normalizeTaxSystem(taxType, taxEntries.map((entry) => entry.taxType));

  return {
    source: "business_profile",
    country: firstText(
      setup?.companyInfo.taxResidenceCountry,
      setup?.companyInfo.countryOfRegistration,
      setup?.companyInfo.country,
    ),
    currency: firstText(setup?.currencySettings.primaryCurrency, setup?.currencySettings.reportingCurrency),
    legalStructure: normalizeLegalStructure(setup?.companyInfo.legalStructure),
    taxSystem,
    vatRegistered: normalizeRegisteredStatus(setup?.taxSettings.taxRegistered),
    defaultVatRate: firstNumber(
      setup?.taxSettings.standardTaxRate,
      ...taxEntries
        .filter((entry) => /vat|gst|sales tax|default|standard/i.test(entry.taxType))
        .map((entry) => entry.percentage),
    ),
    fiscalPeriod: fiscalPeriodLabel(setup?.companyInfo.fiscalYearStart, setup?.companyInfo.fiscalYearEnd),
    businessType: firstText(setup?.companyInfo.businessType, setup?.revenueModel.businessModels?.[0]),
    industry: firstText(setup?.companyInfo.industry),
  };
}

export const buildAccountingContext = getAccountingContext;

function normalizeTaxSystem(primary: string | null, fallbackTypes: unknown[]) {
  const primaryKey = primary?.toLowerCase().trim() as TaxType | undefined;
  if (primaryKey && taxTypeLabels.has(primaryKey)) return taxTypeLabels.get(primaryKey) ?? primary;

  const joined = fallbackTypes.map((value) => String(value ?? "")).join(" ");
  if (/vat/i.test(joined)) return "VAT";
  if (/gst/i.test(joined)) return "GST";
  if (/sales tax/i.test(joined)) return "Sales Tax";
  return null;
}

function normalizeLegalStructure(value: unknown) {
  const key = firstText(value)?.toLowerCase().trim() as LegalStructure | undefined;
  if (key && legalStructureLabels.has(key)) return legalStructureLabels.get(key) ?? key;
  return firstText(value);
}

function normalizeRegisteredStatus(value: unknown) {
  if (value === true || value === "yes") return true;
  if (value === false || value === "no") return false;
  return null;
}

function fiscalPeriodLabel(start: unknown, end: unknown) {
  const values = [firstText(start), firstText(end)].filter(Boolean);
  return values.length > 0 ? values.join(" to ") : null;
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    if (Array.isArray(value)) {
      const nested = firstText(...value);
      if (nested) return nested;
      continue;
    }
    if (typeof value !== "string") continue;
    const text = value.trim();
    if (text) return text;
  }
  return null;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const normalized = normalizeRate(value);
    if (normalized !== null) return normalized;
  }
  return null;
}

function normalizeRate(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return Math.round(value * 100) / 100;
  if (typeof value !== "string") return null;
  const trimmed = value.replace("%", "").replace(",", ".").trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
}
