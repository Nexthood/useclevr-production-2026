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
    /\b(deutsch|bitte|kontakt|kontaktiere|sprichst|sprechen|senden|bestatigen|bestaetigen|kannst du|kann ich|wie kann|was ist|was kann|was kostet|welche|daten|deine|gib mir|zeige mir|fur wen|für wen|gedacht|hochladen|rechnung|gutschrift|schlussel|schlüssel|datensatz|bericht|umsatz|marge|lager|handler|händler|verkauf|verkaufsanalyse|prognose|unterstutzung|unterstuetzung)\b/.test(
      normalized,
    )
  ) {
    return "german";
  }
  if (
    /\b(nederlands|spreek|talen|wat kan|wat is|voor wie|hoe kan|kan ik|uploaden|factuur|gegevensset|gegevens|tegoed|abonnement|omzet|marge|winkelier|voorraad|ondersteuning)\b/.test(
      normalized,
    )
  ) {
    return "dutch";
  }
  if (
    /[¿¡ñ]/i.test(question) ||
    /\b(espanol|español|explicame|explícame|arquitectura|interna|hablas|idiomas|que es|para quien|como puedo|puedo|que puede|que puedes|subir|factura|creditos|créditos|conjunto de datos|inventario|ingresos|margen|soporte)\b/.test(
      normalized,
    )
  ) {
    return "spanish";
  }
  if (
    /[áéíóöőúüű]/i.test(question) ||
    /\b(magyar|magyarazd|magyarázd|mit tud|mi az|kinek|hogyan tudok|tudok|beszelsz|beszélsz|nyelv|feltoltes|feltöltés|szamla|számla|kredit|adat|adatkeszlet|adatkészlet|keszlet|készlet|arbevetel|árbevétel|bevetel|bevétel|arres|árrés|tamogatas|támogatás)\b/.test(
      normalized,
    )
  ) {
    return "hungarian";
  }
  if (
    /[ăâîșşțţ]/i.test(question) ||
    /\b(romana|română|vorbesti|vorbești|limbi|ce este|pentru cine|cum pot|pot sa|pot să|ce poate|incarcare|încărcare|factura|credite|set de date|abonament|venit|marja|stoc|suport)\b/.test(
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
