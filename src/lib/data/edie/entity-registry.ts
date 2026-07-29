import { normalizeSemanticTerm } from "./semantic-dictionary";
import type {
  EntityPatternDefinition,
  EntityPatternType,
  EntityRegistry,
  EntityRegistryEntry,
  EntityRegistryPlugin,
  EntityType,
} from "./entity-types";
import type { SemanticCategory } from "./semantic-types";

export interface EntityPatternMatch {
  patternType: EntityPatternType;
  value: string;
  confidence: number;
}

export class DefaultEntityRegistry {
  private readonly entries = new Map<Exclude<EntityType, "Unknown">, EntityRegistryEntry>();
  private readonly patternDefinitions = new Map<EntityPatternType, EntityPatternDefinition>();
  private readonly installedPlugins: EntityRegistryPlugin[] = [];

  constructor(registry: EntityRegistry = defaultEntityRegistryDefinition) {
    registry.entityTypes.forEach((entry) => this.registerEntityType(entry));
    registry.patterns.forEach((pattern) => this.registerPattern(pattern));
    registry.plugins.forEach((plugin) => this.registerPlugin(plugin));
  }

  version(): EntityRegistry["version"] {
    return "edie.entity-registry.v1";
  }

  registerEntityType(entry: EntityRegistryEntry): void {
    this.entries.set(entry.entityType, entry);
  }

  registerPattern(pattern: EntityPatternDefinition): void {
    this.patternDefinitions.set(pattern.id, pattern);
  }

  registerPlugin(plugin: EntityRegistryPlugin): void {
    this.installedPlugins.push(plugin);
    plugin.register(this.toDefinition());
  }

  getEntityType(entityType: Exclude<EntityType, "Unknown">): EntityRegistryEntry | undefined {
    return this.entries.get(entityType);
  }

  getPattern(patternType: EntityPatternType): EntityPatternDefinition | undefined {
    return this.patternDefinitions.get(patternType);
  }

  listEntityTypes(): EntityRegistryEntry[] {
    return [...this.entries.values()].sort((left, right) => left.priority - right.priority);
  }

  listPatterns(): EntityPatternDefinition[] {
    return [...this.patternDefinitions.values()].sort(
      (left, right) => left.priority - right.priority,
    );
  }

  matchPatterns(value: unknown): EntityPatternMatch[] {
    const text = String(value ?? "").trim();

    if (!text) {
      return [];
    }

    return this.listPatterns()
      .filter(
        (definition) =>
          definition.pattern.test(text) && (!definition.validator || definition.validator(text)),
      )
      .map((definition) => ({
        patternType: definition.id,
        value: text,
        confidence: patternConfidence(definition.id, text),
      }));
  }

  findDictionaryHits(
    columnName: string,
  ): Array<{ entityType: Exclude<EntityType, "Unknown">; alias: string }> {
    const normalized = normalizeSemanticTerm(columnName);
    const compact = normalized.replace(/\s+/g, "");

    return this.listEntityTypes().flatMap((entry) =>
      entry.aliases
        .filter((alias) => {
          const normalizedAlias = normalizeSemanticTerm(alias);
          return (
            normalized === normalizedAlias || compact.includes(normalizedAlias.replace(/\s+/g, ""))
          );
        })
        .map((alias) => ({ entityType: entry.entityType, alias })),
    );
  }

  toDefinition(): EntityRegistry {
    return {
      version: this.version(),
      entityTypes: this.listEntityTypes(),
      patterns: this.listPatterns(),
      plugins: [...this.installedPlugins],
    };
  }
}

export const defaultEntityRegistryDefinition: EntityRegistry = {
  version: "edie.entity-registry.v1",
  entityTypes: [
    entity(
      "Customer",
      10,
      ["Customer", "Email", "Phone"],
      ["customer", "cust", "buyer", "client"],
      ["Email", "Phone", "UUID"],
      ["Order", "Invoice", "Payment"],
    ),
    entity(
      "Supplier",
      20,
      ["Supplier", "Email", "Phone"],
      ["supplier", "vendor", "seller"],
      ["Email", "Phone", "VAT Number", "Tax ID"],
      ["Product Name", "Expense", "Invoice"],
    ),
    entity(
      "Lead",
      30,
      ["Customer", "Email", "Phone", "Status"],
      ["lead", "prospect"],
      ["Email", "Phone"],
      ["Customer", "Employee"],
    ),
    entity(
      "Company",
      40,
      ["Customer", "Supplier"],
      ["company", "business", "organization", "organisation"],
      ["VAT Number", "Tax ID"],
      ["Email", "Phone", "Country"],
    ),
    entity(
      "Employee",
      50,
      ["Employee", "Email", "Phone"],
      ["employee", "staff", "worker"],
      ["Email", "Phone", "UUID"],
      ["Department"],
    ),
    entity(
      "Department",
      60,
      ["Department"],
      ["department", "team", "cost center"],
      [],
      ["Employee", "Expense"],
    ),
    entity(
      "Product",
      70,
      ["Product Name", "SKU", "Category", "Brand"],
      ["product", "item", "article"],
      ["SKU Pattern", "Barcode", "EAN", "GTIN"],
      ["Quantity", "Inventory", "Revenue"],
    ),
    entity(
      "Product Variant",
      80,
      ["Product Name", "SKU", "Brand"],
      ["variant", "option", "size", "color", "colour"],
      ["SKU Pattern", "Barcode"],
      ["Product Name", "Category"],
    ),
    entity(
      "SKU",
      90,
      ["SKU"],
      ["sku", "item code", "product code"],
      ["SKU Pattern", "Barcode"],
      ["Product Name"],
    ),
    entity(
      "Category",
      100,
      ["Category"],
      ["category", "segment", "class"],
      [],
      ["Product Name", "Brand"],
    ),
    entity("Brand", 110, ["Brand"], ["brand", "make"], [], ["Product Name", "Category"]),
    entity(
      "Order",
      120,
      ["Order", "Customer", "Date"],
      ["order", "purchase"],
      ["Order Number", "UUID"],
      ["Customer", "Revenue", "Payment"],
    ),
    entity(
      "Order Item",
      130,
      ["Order", "SKU", "Quantity"],
      ["order item", "line item"],
      ["Order Number", "SKU Pattern"],
      ["Product Name", "Revenue"],
    ),
    entity(
      "Invoice",
      140,
      ["Invoice", "Customer", "Date"],
      ["invoice", "bill"],
      ["Invoice Number", "UUID"],
      ["Payment", "Tax", "Revenue"],
    ),
    entity(
      "Invoice Line",
      150,
      ["Invoice", "SKU", "Quantity"],
      ["invoice line", "bill line"],
      ["Invoice Number", "SKU Pattern"],
      ["Product Name", "Tax"],
    ),
    entity(
      "Payment",
      160,
      ["Payment", "Currency", "Date"],
      ["payment", "paid", "settlement"],
      ["ISO Currency", "UUID"],
      ["Invoice", "Customer"],
    ),
    entity(
      "Refund",
      170,
      ["Payment", "Revenue", "Date"],
      ["refund", "return", "chargeback"],
      ["UUID", "Order Number"],
      ["Order", "Customer"],
    ),
    entity(
      "Subscription",
      180,
      ["Customer", "Payment", "Date", "Status"],
      ["subscription", "plan", "recurring"],
      ["UUID"],
      ["Customer", "Revenue"],
    ),
    entity(
      "Store",
      190,
      ["Store", "Region", "Country"],
      ["store", "shop", "branch"],
      ["ZIP Code", "GPS Coordinates"],
      ["City", "Postal Code", "Warehouse"],
    ),
    entity(
      "Location",
      200,
      ["Country", "Region", "City", "Postal Code", "Latitude", "Longitude"],
      ["location", "address", "geo"],
      ["ZIP Code", "Country Code", "GPS Coordinates"],
      ["Store", "Warehouse"],
    ),
    entity(
      "Warehouse",
      210,
      ["Warehouse", "Region", "Country"],
      ["warehouse", "depot", "fulfillment"],
      ["ZIP Code", "GPS Coordinates"],
      ["Inventory", "SKU"],
    ),
    entity(
      "Inventory Item",
      220,
      ["Inventory", "SKU", "Quantity"],
      ["inventory", "stock", "on hand"],
      ["SKU Pattern", "Barcode"],
      ["Warehouse", "Product Name"],
    ),
    entity(
      "Shipment",
      230,
      ["Order", "Date", "Status"],
      ["shipment", "delivery", "tracking"],
      ["Order Number", "License Plate"],
      ["Supplier", "Customer"],
    ),
    entity(
      "Carrier",
      240,
      ["Supplier"],
      ["carrier", "shipper", "courier"],
      ["VAT Number", "Tax ID"],
      ["Order", "Status"],
    ),
    entity(
      "Expense",
      250,
      ["Expense", "Supplier", "Date"],
      ["expense", "spend", "cost"],
      ["Invoice Number", "ISO Currency"],
      ["Department", "Tax"],
    ),
    entity(
      "Asset",
      260,
      ["Expense", "Department"],
      ["asset", "equipment", "fixed asset"],
      ["UUID", "Barcode"],
      ["Department"],
    ),
    entity(
      "Tax",
      270,
      ["Tax"],
      ["tax", "vat", "gst"],
      ["VAT Number", "Tax ID"],
      ["Invoice", "Payment"],
    ),
    entity(
      "Currency",
      280,
      ["Currency"],
      ["currency", "money", "iso currency"],
      ["ISO Currency"],
      ["Payment", "Revenue"],
    ),
    entity(
      "Project",
      290,
      ["Department", "Status", "Date"],
      ["project", "program", "initiative"],
      ["UUID"],
      ["Employee", "Expense"],
    ),
    entity(
      "Task",
      300,
      ["Status", "Date", "Employee"],
      ["task", "todo", "work item"],
      ["UUID"],
      ["Department", "Employee"],
    ),
  ],
  patterns: [
    pattern("Email", 10, /^[^\s@]+@[^\s@]+\.[^\s@]+$/i),
    pattern("Phone", 20, /^\+?[\d\s().-]{7,}$/),
    pattern("IBAN", 30, /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/i, isValidIbanLength),
    pattern("SWIFT", 40, /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/i),
    pattern("VAT Number", 50, /^[A-Z]{2}[A-Z0-9]{8,12}$/i, hasDigit),
    pattern("Tax ID", 60, /^(tax[-_ ]?)?[A-Z0-9]{6,18}$/i, hasDigit),
    pattern(
      "UUID",
      70,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    ),
    pattern("Invoice Number", 80, /^(inv|invoice)[-_ ]?\d{3,}$/i),
    pattern("Order Number", 90, /^(ord|order|po)[-_ ]?\d{3,}$/i),
    pattern("SKU Pattern", 100, /^[A-Z]{2,8}[-_ ]?\d{2,}[A-Z0-9-]*$/i),
    pattern("Barcode", 110, /^\d{8,14}$/),
    pattern("EAN", 120, /^\d{13}$/),
    pattern("GTIN", 130, /^\d{8}|\d{12}|\d{13}|\d{14}$/),
    pattern("ZIP Code", 140, /^[A-Z0-9][A-Z0-9 -]{2,12}$/i),
    pattern("Country Code", 150, /^[A-Z]{2,3}$/i),
    pattern("ISO Currency", 160, /^(USD|EUR|GBP|CAD|AUD|CHF|HUF|RON|SEK|NOK|DKK|JPY)$/i),
    pattern("GPS Coordinates", 170, /^-?\d{1,2}\.\d+,\s*-?\d{1,3}\.\d+$/),
    pattern("License Plate", 180, /^[A-Z0-9]{1,4}([- ]?[A-Z0-9]{1,4}){1,3}$/i),
  ],
  plugins: [],
};

export function createDefaultEntityRegistry(): DefaultEntityRegistry {
  return new DefaultEntityRegistry(defaultEntityRegistryDefinition);
}

function entity(
  entityType: Exclude<EntityType, "Unknown">,
  priority: number,
  semanticCategories: SemanticCategory[],
  aliases: string[],
  patternTypes: EntityPatternType[],
  relatedSemanticCategories: SemanticCategory[],
): EntityRegistryEntry {
  return {
    entityType,
    version: "1.0.0",
    priority,
    semanticCategories,
    requiredSignals: Math.min(2, Math.max(1, semanticCategories.length)),
    aliases,
    patternTypes,
    relatedSemanticCategories,
    metadata: {
      futureResolution: "prepared",
      pluginCompatible: true,
    },
  };
}

function pattern(
  id: EntityPatternType,
  priority: number,
  regex: RegExp,
  validator?: (value: string) => boolean,
): EntityPatternDefinition {
  return {
    id,
    version: "1.0.0",
    priority,
    pattern: regex,
    validator,
    metadata: {
      extensible: true,
    },
  };
}

function isValidIbanLength(value: string): boolean {
  const compact = value.replace(/\s+/g, "");
  return compact.length >= 15 && compact.length <= 34;
}

function hasDigit(value: string): boolean {
  return /\d/.test(value);
}

function patternConfidence(patternType: EntityPatternType, value: string): number {
  if (["Email", "UUID", "IBAN", "SWIFT", "ISO Currency", "GPS Coordinates"].includes(patternType)) {
    return 0.95;
  }

  if (["Invoice Number", "Order Number", "SKU Pattern", "EAN", "GTIN"].includes(patternType)) {
    return 0.88;
  }

  if (patternType === "Barcode" && value.length >= 12) {
    return 0.86;
  }

  return 0.76;
}
