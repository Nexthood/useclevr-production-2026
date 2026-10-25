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
  const hyphenless = normalized.replace(/-/g, " ").replace(/\s+/g, " ").trim();

  if (/[àçèêëïôùûœ]/i.test(question)) return "french";
  if (
    /\b(agentenpass|agentenpasses|erzahl|erklare|deutsch|bitte|kontakt|kontaktiere|sprichst|sprechen|senden|bestatigen|bestaetigen|kannst du|kann ich|wie kann|was ist|was kann|was kostet|was enthalt|enthalt|enthalten|welche|daten|deine|gib mir|zeige mir|fur wen|für wen|gedacht|hochladen|rechnung|gutschrift|schlussel|schlüssel|datensatz|bericht|umsatz|marge|lager|handler|händler|verkauf|verkaufsanalyse|prognose|unterstutzung|unterstuetzung)\b/.test(
      normalized,
    )
  ) {
    return "german";
  }
  if (
    /\b(paspoort|paspoorten|vertel|leg uit|nederlands|spreek|talen|wat kan|wat is|voor wie|hoe kan|kan ik|uploaden|factuur|gegevensset|gegevens|tegoed|abonnement|omzet|marge|winkelier|voorraad|ondersteuning|bevat)\b/.test(
      normalized,
    )
  ) {
    return "dutch";
  }
  if (
    /[¿¡ñ]/i.test(question) ||
    /\b(pasaporte|pasaportes|cuentame|espanol|español|explicame|explícame|arquitectura|interna|hablas|idiomas|que es|para quien|como puedo|puedo|que puede|que puedes|subir|factura|creditos|créditos|conjunto de datos|inventario|ingresos|margen|soporte)\b/.test(
      normalized,
    )
  ) {
    return "spanish";
  }
  if (
    /\b(passeport|passeports|dis moi|explique|francais|parles|parlez|je parle|langues|quelle langue|quelles langues|que peux|que peut|qu est ce que|pour qui|comment puis|comment je peux|comment fonctionne|puis je|combien coute|combien|connecter|televerser|telechargement|facture|factures|jeu de donnees|revenu|remboursement|annulation|resiliation|instructions systeme)\b/.test(
      normalized,
    ) ||
    /\b(passeport|passeports|dis moi|explique|francais|parles|parlez|que peux|que peut|qu est ce que|puis je|combien|comment puis)\b/.test(hyphenless)
  ) {
    return "french";
  }
  // Swedish relies on lexemes, not å/ä/ö characters: those vowels overlap with
  // German and Hungarian, so only Swedish-specific words and phrases decide.
  if (
    /\b(agentpass|agentpasset|beratta|forklara|svenska|svensk|swedish|sprak|talar|pratar|krediter|faktura|fakturor|fakturering|betalning|prenumeration|prenumerationen|abonnemang|uppsagning|uppsagningen|uppladdning|uppladdningar|ansluta|anslutning|anslutningar|kontakta|kontaktar|avsluta|losenord|hemlighet|felsokning|hjalp|filformat)\b/.test(
      normalized,
    ) ||
    /\b(vad kan|hur kan|hur fungerar|vad kostar|vad hander|vad ar|vad innehaller|kan jag|jag vill|jag behover|jag heter|hur manga|hur mycket|ladda upp|laddar upp|lasa upp|las upp|laser jag|vilka sprak|vilket sprak|visa mig|kan du visa|ge mig|historisk data|historiska data|mina krediter|mina data|min prenumeration|mitt abonnemang|mina datasets|mina fakturor|saga upp)\b/.test(
      normalized,
    )
  ) {
    return "swedish";
  }
  if (
    /[áéíóöőúüű]/i.test(question) ||
    /\b(utlevel|utlevelet|utlevelem|magyar|magyarazd|magyarázd|mit tud|mi az|kinek|hogyan tudok|tudok|beszelsz|beszélsz|nyelv|feltoltes|feltöltés|szamla|számla|kredit|adat|adatkeszlet|adatkészlet|keszlet|készlet|arbevetel|árbevétel|bevetel|bevétel|arres|árrés|tamogatas|támogatás)\b/.test(
      normalized,
    )
  ) {
    return "hungarian";
  }
  if (
    /[ăâîșşțţ]/i.test(question) ||
    /\b(pasaport|pasaportul|pasaportului|spune mi|spune-mi|explica|romana|română|vorbesti|vorbești|limbi|ce este|pentru cine|cum pot|pot sa|pot să|ce poate|incarcare|încărcare|factura|credite|set de date|abonament|venit|marja|stoc|suport)\b/.test(
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
    french: "French",
    spanish: "Spanish",
    hungarian: "Hungarian",
    romanian: "Romanian",
    swedish: "Swedish",
  }[language];
}
