import type {
  SemanticCategory,
  SemanticDictionary,
  SemanticDictionaryAlias,
  SemanticDictionaryEntry,
} from "./semantic-types";
import type { StructureDataType } from "./structure-types";

export interface SemanticDictionaryAliasHit {
  category: Exclude<SemanticCategory, "Unknown">;
  alias: SemanticDictionaryAlias;
  normalizedTerm: string;
}

export interface SemanticDictionaryIndex {
  dictionary: SemanticDictionary;
  aliasesByNormalizedTerm: Map<string, SemanticDictionaryAliasHit[]>;
  aliasesByToken: Map<string, SemanticDictionaryAliasHit[]>;
  entriesByCategory: Map<Exclude<SemanticCategory, "Unknown">, SemanticDictionaryEntry>;
}

const dictionaryIndexCache = new WeakMap<SemanticDictionary, SemanticDictionaryIndex>();

const revenueAliases = [
  ["revenue", "en"],
  ["sales", "en"],
  ["sale", "en"],
  ["sales amount", "en"],
  ["sales_amount", "en"],
  ["gross sales", "en"],
  ["gross_sales", "en"],
  ["turnover", "en"],
  ["gmv", "en"],
  ["gross merchandise value", "en"],
  ["gross_merchandise_value", "en"],
  ["income", "en"],
  ["income total", "en"],
  ["income_total", "en"],
  ["net sales", "en"],
  ["net_sales", "en"],
  ["umsatz", "de"],
  ["erloes", "de"],
  ["erlös", "de"],
  ["omzet", "nl"],
  ["ventes", "fr"],
  ["chiffre affaires", "fr"],
  ["chiffre_affaires", "fr"],
  ["ingresos", "es"],
  ["ventas", "es"],
  ["arbevetel", "hu"],
  ["árbevétel", "hu"],
  ["bevetel", "hu"],
  ["bevétel", "hu"],
  ["venituri", "ro"],
  ["vanzari", "ro"],
  ["vânzări", "ro"],
  ["ricavi", "it"],
  ["vendite", "it"],
  ["receita", "pt"],
  ["vendas", "pt"],
] as const;

const quantityAliases = [
  ["quantity", "en"],
  ["qty", "en"],
  ["qnty", "en"],
  ["quanity", "en"],
  ["units", "en"],
  ["unit count", "en"],
  ["unit_count", "en"],
  ["count", "en"],
  ["menge", "de"],
  ["anzahl", "de"],
  ["aantal", "nl"],
  ["quantite", "fr"],
  ["quantité", "fr"],
  ["cantidad", "es"],
  ["mennyiseg", "hu"],
  ["mennyiség", "hu"],
  ["cantitate", "ro"],
  ["quantita", "it"],
  ["quantità", "it"],
  ["quantidade", "pt"],
] as const;

export const defaultSemanticDictionary: SemanticDictionary = {
  version: "edie.semantic-dictionary.v1",
  languages: ["en", "de", "nl", "fr", "es", "hu", "ro", "it", "pt"],
  entries: [
    entry(
      "Revenue",
      revenueAliases,
      ["Currency", "Decimal", "Integer"],
      ["Money"],
      ["Date", "Quantity", "Customer", "Order", "Product Name"],
    ),
    entry(
      "Cost",
      [
        ["cost", "en"],
        ["costs", "en"],
        ["expense cost", "en"],
        ["cogs", "en"],
        ["unit cost", "en"],
        ["purchase_cost", "en"],
        ["kosten", "de"],
        ["kosten", "nl"],
        ["cout", "fr"],
        ["coût", "fr"],
        ["coste", "es"],
        ["koltseg", "hu"],
        ["költség", "hu"],
        ["costuri", "ro"],
        ["costo", "it"],
        ["custo", "pt"],
      ],
      ["Currency", "Decimal", "Integer"],
      ["Money"],
      ["Revenue", "Profit", "Margin"],
    ),
    entry(
      "Profit",
      [
        ["profit", "en"],
        ["gross profit", "en"],
        ["net profit", "en"],
        ["earnings", "en"],
        ["gewinn", "de"],
        ["winst", "nl"],
        ["benefice", "fr"],
        ["bénéfice", "fr"],
        ["ganancia", "es"],
        ["nyereseg", "hu"],
        ["profit ro", "ro"],
        ["utile", "it"],
        ["lucro", "pt"],
      ],
      ["Currency", "Decimal", "Integer"],
      ["Money"],
      ["Revenue", "Cost", "Margin"],
    ),
    entry(
      "Margin",
      [
        ["margin", "en"],
        ["margin percent", "en"],
        ["margin %", "en"],
        ["profit margin", "en"],
        ["marge", "de"],
        ["marge", "nl"],
        ["marge", "fr"],
        ["margen", "es"],
        ["haszonkulcs", "hu"],
        ["marja", "ro"],
        ["margine", "it"],
        ["margem", "pt"],
      ],
      ["Percentage", "Decimal"],
      ["Percentage"],
      ["Revenue", "Profit", "Cost"],
    ),
    entry(
      "Quantity",
      quantityAliases,
      ["Integer", "Decimal"],
      ["Number"],
      ["SKU", "Product Name", "Inventory"],
    ),
    entry(
      "Inventory",
      [
        ["inventory", "en"],
        ["stock", "en"],
        ["stock on hand", "en"],
        ["on hand", "en"],
        ["bestand", "de"],
        ["voorraad", "nl"],
        ["inventaire", "fr"],
        ["inventario", "es"],
        ["keszlet", "hu"],
        ["készlet", "hu"],
        ["stoc", "ro"],
        ["scorte", "it"],
        ["estoque", "pt"],
      ],
      ["Integer", "Decimal"],
      ["Number"],
      ["SKU", "Warehouse", "Quantity"],
    ),
    entry(
      "SKU",
      [
        ["sku", "en"],
        ["stock keeping unit", "en"],
        ["product code", "en"],
        ["product_code", "en"],
        ["item code", "en"],
        ["item_code", "en"],
        ["artikelnummer", "de"],
        ["artikel nr", "nl"],
        ["reference produit", "fr"],
        ["codigo producto", "es"],
        ["cikkszam", "hu"],
        ["cod produs", "ro"],
        ["codice articolo", "it"],
        ["codigo produto", "pt"],
      ],
      ["Text", "Integer"],
      ["Identifier"],
      ["Product Name", "Category", "Quantity"],
    ),
    entry(
      "Product Name",
      [
        ["product", "en"],
        ["product name", "en"],
        ["item name", "en"],
        ["item", "en"],
        ["artikel", "de"],
        ["productnaam", "nl"],
        ["produit", "fr"],
        ["producto", "es"],
        ["termek", "hu"],
        ["termék", "hu"],
        ["produs", "ro"],
        ["prodotto", "it"],
        ["produto", "pt"],
      ],
      ["Text"],
      ["Text"],
      ["SKU", "Category", "Brand"],
    ),
    entry(
      "Category",
      [
        ["category", "en"],
        ["subcategory", "en"],
        ["segment", "en"],
        ["categorie", "de"],
        ["categorie", "nl"],
        ["catégorie", "fr"],
        ["categoria", "es"],
        ["kategoria", "hu"],
        ["categorie", "ro"],
        ["categoria", "it"],
        ["categoria", "pt"],
      ],
      ["Text"],
      ["Text"],
      ["Product Name", "Brand"],
    ),
    entry(
      "Brand",
      [
        ["brand", "en"],
        ["make", "en"],
        ["marke", "de"],
        ["merk", "nl"],
        ["marque", "fr"],
        ["marca", "es"],
        ["marka", "hu"],
        ["marca", "ro"],
        ["marca", "it"],
        ["marca", "pt"],
      ],
      ["Text"],
      ["Text"],
      ["Product Name", "Category"],
    ),
    entry(
      "Customer",
      [
        ["customer", "en"],
        ["customer id", "en"],
        ["customer_id", "en"],
        ["cust id", "en"],
        ["cust_id", "en"],
        ["buyer", "en"],
        ["buyer id", "en"],
        ["buyer_id", "en"],
        ["client", "en"],
        ["kunde", "de"],
        ["klant", "nl"],
        ["client", "fr"],
        ["cliente", "es"],
        ["vevo", "hu"],
        ["vevő", "hu"],
        ["client", "ro"],
        ["cliente", "it"],
        ["cliente", "pt"],
      ],
      ["Text", "Integer", "UUID", "Email"],
      ["Identifier", "Email"],
      ["Order", "Revenue", "Email"],
    ),
    entry(
      "Supplier",
      [
        ["supplier", "en"],
        ["vendor", "en"],
        ["seller", "en"],
        ["seller id", "en"],
        ["seller_id", "en"],
        ["lieferant", "de"],
        ["leverancier", "nl"],
        ["fournisseur", "fr"],
        ["proveedor", "es"],
        ["beszallito", "hu"],
        ["furnizor", "ro"],
        ["fornitore", "it"],
        ["fornecedor", "pt"],
      ],
      ["Text", "Integer", "UUID"],
      ["Identifier"],
      ["Cost", "Product Name"],
    ),
    entry(
      "Order",
      [
        ["order", "en"],
        ["order id", "en"],
        ["order_id", "en"],
        ["purchase order", "en"],
        ["auftrag", "de"],
        ["bestelling", "nl"],
        ["commande", "fr"],
        ["pedido", "es"],
        ["rendeles", "hu"],
        ["comanda", "ro"],
        ["ordine", "it"],
        ["pedido", "pt"],
      ],
      ["Text", "Integer", "UUID"],
      ["Identifier"],
      ["Customer", "Revenue", "Date"],
    ),
    entry(
      "Invoice",
      [
        ["invoice", "en"],
        ["invoice id", "en"],
        ["invoice_id", "en"],
        ["invoice number", "en"],
        ["rechnung", "de"],
        ["factuur", "nl"],
        ["facture", "fr"],
        ["factura", "es"],
        ["szamla", "hu"],
        ["factura", "ro"],
        ["fattura", "it"],
        ["fatura", "pt"],
      ],
      ["Text", "Integer", "UUID"],
      ["Identifier"],
      ["Customer", "Payment", "Tax"],
    ),
    entry(
      "Payment",
      [
        ["payment", "en"],
        ["paid", "en"],
        ["payment method", "en"],
        ["zahlung", "de"],
        ["betaling", "nl"],
        ["paiement", "fr"],
        ["pago", "es"],
        ["fizetes", "hu"],
        ["plata", "ro"],
        ["pagamento", "it"],
        ["pagamento", "pt"],
      ],
      ["Text", "Currency", "Decimal", "Integer", "Boolean"],
      ["Money", "Boolean"],
      ["Invoice", "Revenue"],
    ),
    entry(
      "Discount",
      [
        ["discount", "en"],
        ["markdown", "en"],
        ["rebate", "en"],
        ["rabatt", "de"],
        ["korting", "nl"],
        ["remise", "fr"],
        ["descuento", "es"],
        ["kedvezmeny", "hu"],
        ["reducere", "ro"],
        ["sconto", "it"],
        ["desconto", "pt"],
      ],
      ["Currency", "Decimal", "Integer", "Percentage"],
      ["Money", "Percentage"],
      ["Revenue"],
    ),
    entry(
      "Tax",
      [
        ["tax", "en"],
        ["vat", "en"],
        ["sales tax", "en"],
        ["mwst", "de"],
        ["btw", "nl"],
        ["tva", "fr"],
        ["iva", "es"],
        ["afa", "hu"],
        ["áfa", "hu"],
        ["tva", "ro"],
        ["iva", "it"],
        ["iva", "pt"],
      ],
      ["Currency", "Decimal", "Integer", "Percentage"],
      ["Money", "Percentage"],
      ["Invoice", "Revenue"],
    ),
    entry(
      "Currency",
      [
        ["currency", "en"],
        ["currency code", "en"],
        ["iso currency", "en"],
        ["wahrung", "de"],
        ["währung", "de"],
        ["valuta", "nl"],
        ["devise", "fr"],
        ["moneda", "es"],
        ["penznem", "hu"],
        ["moneda", "ro"],
        ["valuta", "it"],
        ["moeda", "pt"],
      ],
      ["Text"],
      ["CurrencyCode"],
      ["Revenue", "Cost"],
    ),
    entry(
      "Country",
      [
        ["country", "en"],
        ["nation", "en"],
        ["land", "de"],
        ["land", "nl"],
        ["pays", "fr"],
        ["pais", "es"],
        ["país", "es"],
        ["orszag", "hu"],
        ["țară", "ro"],
        ["tara", "ro"],
        ["paese", "it"],
        ["pais", "pt"],
        ["país", "pt"],
      ],
      ["Text"],
      ["Country"],
      ["Region", "City"],
    ),
    entry(
      "Region",
      [
        ["region", "en"],
        ["state", "en"],
        ["province", "en"],
        ["territory", "en"],
        ["gebiet", "de"],
        ["regio", "nl"],
        ["région", "fr"],
        ["region", "es"],
        ["régió", "hu"],
        ["regiune", "ro"],
        ["regione", "it"],
        ["regiao", "pt"],
      ],
      ["Text"],
      ["Text"],
      ["Country", "City"],
    ),
    entry(
      "Store",
      [
        ["store", "en"],
        ["shop", "en"],
        ["location", "en"],
        ["filiale", "de"],
        ["winkel", "nl"],
        ["magasin", "fr"],
        ["tienda", "es"],
        ["uzlet", "hu"],
        ["magazin", "ro"],
        ["negozio", "it"],
        ["loja", "pt"],
      ],
      ["Text", "Integer"],
      ["Identifier"],
      ["Region", "Revenue"],
    ),
    entry(
      "Warehouse",
      [
        ["warehouse", "en"],
        ["depot", "en"],
        ["fulfillment center", "en"],
        ["lager", "de"],
        ["magazijn", "nl"],
        ["entrepot", "fr"],
        ["almacen", "es"],
        ["raktar", "hu"],
        ["depozit", "ro"],
        ["magazzino", "it"],
        ["armazem", "pt"],
      ],
      ["Text", "Integer"],
      ["Identifier"],
      ["Inventory", "SKU"],
    ),
    entry(
      "Employee",
      [
        ["employee", "en"],
        ["employee id", "en"],
        ["staff", "en"],
        ["worker", "en"],
        ["mitarbeiter", "de"],
        ["medewerker", "nl"],
        ["employé", "fr"],
        ["empleado", "es"],
        ["alkalmazott", "hu"],
        ["angajat", "ro"],
        ["dipendente", "it"],
        ["funcionario", "pt"],
      ],
      ["Text", "Integer", "Email"],
      ["Identifier", "Email"],
      ["Department"],
    ),
    entry(
      "Department",
      [
        ["department", "en"],
        ["team", "en"],
        ["cost center", "en"],
        ["abteilung", "de"],
        ["afdeling", "nl"],
        ["departement", "fr"],
        ["departamento", "es"],
        ["osztaly", "hu"],
        ["departament", "ro"],
        ["dipartimento", "it"],
        ["departamento", "pt"],
      ],
      ["Text"],
      ["Text"],
      ["Employee", "Expense"],
    ),
    entry(
      "Expense",
      [
        ["expense", "en"],
        ["spend", "en"],
        ["expenditure", "en"],
        ["operating expense", "en"],
        ["ausgabe", "de"],
        ["uitgave", "nl"],
        ["dépense", "fr"],
        ["gasto", "es"],
        ["kiadas", "hu"],
        ["cheltuiala", "ro"],
        ["spesa", "it"],
        ["despesa", "pt"],
      ],
      ["Currency", "Decimal", "Integer"],
      ["Money"],
      ["Department", "Supplier"],
    ),
    entry(
      "Date",
      [
        ["date", "en"],
        ["day", "en"],
        ["created at", "en"],
        ["updated at", "en"],
        ["order date", "en"],
        ["datum", "de"],
        ["datum", "nl"],
        ["date", "fr"],
        ["fecha", "es"],
        ["datum hu", "hu"],
        ["data", "ro"],
        ["data", "it"],
        ["data", "pt"],
      ],
      ["Date", "DateTime"],
      ["Date"],
      ["Revenue", "Order"],
    ),
    entry(
      "Time",
      [
        ["time", "en"],
        ["hour", "en"],
        ["timestamp", "en"],
        ["zeit", "de"],
        ["tijd", "nl"],
        ["heure", "fr"],
        ["hora", "es"],
        ["ido", "hu"],
        ["ora", "ro"],
        ["ora", "it"],
        ["hora", "pt"],
      ],
      ["Time", "DateTime"],
      ["Time"],
      ["Date"],
    ),
    entry(
      "Email",
      [
        ["email", "en"],
        ["e-mail", "en"],
        ["mail", "en"],
        ["email address", "en"],
        ["courriel", "fr"],
        ["correo", "es"],
        ["e-mail cím", "hu"],
        ["email ro", "ro"],
        ["email it", "it"],
        ["email pt", "pt"],
      ],
      ["Email", "Text"],
      ["Email"],
      ["Customer", "Employee"],
    ),
    entry(
      "Phone",
      [
        ["phone", "en"],
        ["telephone", "en"],
        ["mobile", "en"],
        ["telefon", "de"],
        ["telefoon", "nl"],
        ["téléphone", "fr"],
        ["telefono", "es"],
        ["telefon hu", "hu"],
        ["telefon ro", "ro"],
        ["telefono it", "it"],
        ["telefone", "pt"],
      ],
      ["Phone", "Text"],
      ["Phone"],
      ["Customer", "Supplier"],
    ),
    entry(
      "Website",
      [
        ["website", "en"],
        ["url", "en"],
        ["web site", "en"],
        ["homepage", "en"],
        ["webseite", "de"],
        ["site web", "fr"],
        ["sitio web", "es"],
        ["weboldal", "hu"],
        ["site", "ro"],
        ["sito web", "it"],
        ["site", "pt"],
      ],
      ["URL", "Text"],
      ["URL"],
      ["Customer", "Supplier"],
    ),
    entry(
      "Latitude",
      [
        ["latitude", "en"],
        ["lat", "en"],
        ["breitengrad", "de"],
        ["breedtegraad", "nl"],
        ["latitudine", "it"],
        ["latitudine", "ro"],
        ["latitud", "es"],
        ["latitude pt", "pt"],
      ],
      ["Decimal", "Integer"],
      ["Latitude"],
      ["Longitude", "City"],
    ),
    entry(
      "Longitude",
      [
        ["longitude", "en"],
        ["lng", "en"],
        ["lon", "en"],
        ["long", "en"],
        ["langengrad", "de"],
        ["lengtegraad", "nl"],
        ["longitudine", "it"],
        ["longitudine", "ro"],
        ["longitud", "es"],
        ["longitude pt", "pt"],
      ],
      ["Decimal", "Integer"],
      ["Longitude"],
      ["Latitude", "City"],
    ),
    entry(
      "City",
      [
        ["city", "en"],
        ["town", "en"],
        ["stadt", "de"],
        ["stad", "nl"],
        ["ville", "fr"],
        ["ciudad", "es"],
        ["varos", "hu"],
        ["oras", "ro"],
        ["citta", "it"],
        ["cidade", "pt"],
      ],
      ["Text"],
      ["City"],
      ["Country", "Region"],
    ),
    entry(
      "Postal Code",
      [
        ["postal code", "en"],
        ["postcode", "en"],
        ["zip", "en"],
        ["zip code", "en"],
        ["plz", "de"],
        ["postcode nl", "nl"],
        ["code postal", "fr"],
        ["codigo postal", "es"],
        ["iranyitoszam", "hu"],
        ["cod postal", "ro"],
        ["cap", "it"],
        ["codigo postal pt", "pt"],
      ],
      ["Text", "Integer"],
      ["PostalCode"],
      ["City", "Country"],
    ),
    entry(
      "Status",
      [
        ["status", "en"],
        ["state", "en"],
        ["stage", "en"],
        ["condition", "en"],
        ["status de", "de"],
        ["status nl", "nl"],
        ["statut", "fr"],
        ["estado", "es"],
        ["allapot", "hu"],
        ["stare", "ro"],
        ["stato", "it"],
        ["estado pt", "pt"],
      ],
      ["Text", "Boolean"],
      ["Text", "Boolean"],
      ["Order", "Payment"],
    ),
    entry(
      "Boolean Flag",
      [
        ["flag", "en"],
        ["active", "en"],
        ["enabled", "en"],
        ["is active", "en"],
        ["yes no", "en"],
        ["ja nein", "de"],
        ["waar onwaar", "nl"],
        ["actif", "fr"],
        ["activo", "es"],
        ["aktiv", "hu"],
        ["activ", "ro"],
        ["attivo", "it"],
        ["ativo", "pt"],
      ],
      ["Boolean", "Text"],
      ["Boolean"],
      ["Status"],
    ),
  ],
};

export function createSemanticDictionaryIndex(
  dictionary: SemanticDictionary = defaultSemanticDictionary,
): SemanticDictionaryIndex {
  const cached = dictionaryIndexCache.get(dictionary);

  if (cached) {
    return cached;
  }

  const aliasesByNormalizedTerm = new Map<string, SemanticDictionaryAliasHit[]>();
  const aliasesByToken = new Map<string, SemanticDictionaryAliasHit[]>();
  const entriesByCategory = new Map<
    Exclude<SemanticCategory, "Unknown">,
    SemanticDictionaryEntry
  >();

  for (const entry of dictionary.entries) {
    entriesByCategory.set(entry.category, entry);

    for (const alias of entry.aliases) {
      const normalizedTerm = normalizeSemanticTerm(alias.term);
      const hit: SemanticDictionaryAliasHit = { category: entry.category, alias, normalizedTerm };
      pushMapValue(aliasesByNormalizedTerm, normalizedTerm, hit);

      for (const token of normalizedTerm.split(" ").filter(Boolean)) {
        pushMapValue(aliasesByToken, token, hit);
      }
    }
  }

  const index = { dictionary, aliasesByNormalizedTerm, aliasesByToken, entriesByCategory };
  dictionaryIndexCache.set(dictionary, index);
  return index;
}

export function normalizeSemanticTerm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-./]+/g, " ")
    .replace(/[^a-zA-Z0-9%]+/g, " ")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map(stemSemanticToken)
    .join(" ");
}

export function compactSemanticTerm(value: string): string {
  return normalizeSemanticTerm(value).replace(/\s+/g, "");
}

function entry(
  category: Exclude<SemanticCategory, "Unknown">,
  aliases: ReadonlyArray<readonly [string, string]>,
  expectedDataTypes: StructureDataType[],
  valuePatternIds: string[],
  neighborCategories: SemanticCategory[],
): SemanticDictionaryEntry {
  return {
    category,
    aliases: aliases.map(([term, language]) => ({
      term,
      language,
      industries: ["enterprise"],
      weight: defaultAliasWeight(term),
    })),
    expectedDataTypes,
    valuePatterns: valuePatternIds.map((id) => ({
      id,
      pattern: id,
      weight: defaultPatternWeight(id),
      reason: `${id} values support ${category} semantics.`,
    })),
    neighborCategories,
    statisticalHints: [
      {
        id: "usable-column",
        weight: 0.05,
        reason: "Column has enough populated examples for semantic scoring.",
      },
    ],
  };
}

function defaultAliasWeight(term: string): number {
  if (term.length <= 3) {
    return 0.76;
  }

  if (term.includes("_") || term.includes(" ")) {
    return 0.95;
  }

  return 0.86;
}

function defaultPatternWeight(id: string): number {
  if (id === "Email" || id === "URL" || id === "Latitude" || id === "Longitude") {
    return 0.35;
  }

  if (id === "Money" || id === "Percentage" || id === "Date" || id === "Time") {
    return 0.24;
  }

  return 0.16;
}

function stemSemanticToken(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.length > 4 && token.endsWith("es")) {
    return token.slice(0, -2);
  }

  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }

  return token;
}

function pushMapValue<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const existing = map.get(key);

  if (existing) {
    existing.push(value);
    return;
  }

  map.set(key, [value]);
}
