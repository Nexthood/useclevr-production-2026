import type { SupportedUsyLanguage } from "@/lib/usy/types";

export function normalizeUsyText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s?@._+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectUsyLanguage(question: string): SupportedUsyLanguage {
  const normalized = normalizeUsyText(question);

  if (
    /\b(deutsch|sprichst|sprechen|kannst du|was kann|hochladen|rechnung|gutschrift|datensatz|bericht|umsatz|marge|lager|unterstutzung|unterstuetzung)\b/.test(
      normalized,
    )
  ) {
    return "german";
  }
  if (
    /\b(nederlands|spreek|talen|wat kan|uploaden|factuur|gegevensset|gegevens|tegoed|abonnement|voorraad|ondersteuning)\b/.test(
      normalized,
    )
  ) {
    return "dutch";
  }
  if (
    /\b(espanol|español|hablas|idiomas|que puede|que puedes|subir|factura|creditos|créditos|conjunto de datos|inventario|ingresos|soporte)\b/.test(
      normalized,
    )
  ) {
    return "spanish";
  }
  if (
    /[áéíóöőúüű]/i.test(question) ||
    /\b(magyar|magyarazd|magyarázd|mit tud|beszelsz|beszélsz|nyelv|feltoltes|feltöltés|szamla|számla|kredit|adat|adatkeszlet|adatkészlet|keszlet|készlet|bevetel|bevétel|tamogatas|támogatás)\b/.test(
      normalized,
    )
  ) {
    return "hungarian";
  }
  if (
    /[ăâîșşțţ]/i.test(question) ||
    /\b(romana|română|vorbesti|vorbești|limbi|ce poate|incarcare|încărcare|factura|credite|set de date|abonament|stoc|suport)\b/.test(
      normalized,
    )
  ) {
    return "romanian";
  }

  return "english";
}

export function languageName(language: SupportedUsyLanguage) {
  return {
    english: "English",
    german: "German",
    dutch: "Dutch",
    spanish: "Spanish",
    hungarian: "Hungarian",
    romanian: "Romanian",
  }[language];
}
