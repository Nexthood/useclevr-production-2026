import type {
  RelationshipRegistry,
  RelationshipRegistryEntry,
  RelationshipRegistryPlugin,
  RelationshipType,
} from "./relationship-types";
import type { EntityType } from "./entity-types";
import type { SemanticCategory } from "./semantic-types";

export class DefaultRelationshipRegistry {
  private readonly entries = new Map<RelationshipType, RelationshipRegistryEntry>();
  private readonly installedPlugins: RelationshipRegistryPlugin[] = [];

  constructor(registry: RelationshipRegistry = defaultRelationshipRegistryDefinition) {
    registry.relationshipTypes.forEach((entry) => this.registerRelationshipType(entry));
    registry.plugins.forEach((plugin) => this.registerPlugin(plugin));
  }

  version(): RelationshipRegistry["version"] {
    return "edie.relationship-registry.v1";
  }

  registerRelationshipType(entry: RelationshipRegistryEntry): void {
    this.entries.set(entry.relationshipType, entry);
  }

  registerPlugin(plugin: RelationshipRegistryPlugin): void {
    this.installedPlugins.push(plugin);
    plugin.register(this.toDefinition());
  }

  getRelationshipType(relationshipType: RelationshipType): RelationshipRegistryEntry | undefined {
    return this.entries.get(relationshipType);
  }

  listRelationshipTypes(): RelationshipRegistryEntry[] {
    return [...this.entries.values()].sort((left, right) => left.priority - right.priority);
  }

  toDefinition(): RelationshipRegistry {
    return {
      version: this.version(),
      relationshipTypes: this.listRelationshipTypes(),
      plugins: [...this.installedPlugins],
    };
  }
}

export const defaultRelationshipRegistryDefinition: RelationshipRegistry = {
  version: "edie.relationship-registry.v1",
  relationshipTypes: [
    relationship(
      "Customer -> Order",
      10,
      "Customer",
      "Order",
      ["Customer"],
      ["Order"],
      ["customer order", "buyer purchase"],
    ),
    relationship(
      "Order -> Order Item",
      20,
      "Order",
      "Order Item",
      ["Order"],
      ["SKU", "Quantity"],
      ["order line", "line item"],
    ),
    relationship(
      "Order -> Invoice",
      30,
      "Order",
      "Invoice",
      ["Order"],
      ["Invoice"],
      ["order invoice"],
    ),
    relationship(
      "Invoice -> Payment",
      40,
      "Invoice",
      "Payment",
      ["Invoice"],
      ["Payment"],
      ["invoice payment", "paid invoice"],
    ),
    relationship(
      "Customer -> Invoice",
      50,
      "Customer",
      "Invoice",
      ["Customer"],
      ["Invoice"],
      ["customer invoice"],
    ),
    relationship(
      "Customer -> Payment",
      60,
      "Customer",
      "Payment",
      ["Customer"],
      ["Payment"],
      ["customer payment"],
    ),
    relationship(
      "Customer -> Address",
      70,
      "Customer",
      "Location",
      ["Customer"],
      ["City", "Postal Code", "Country"],
      ["customer address"],
    ),
    relationship(
      "Supplier -> Product",
      80,
      "Supplier",
      "Product",
      ["Supplier"],
      ["Product Name", "SKU"],
      ["supplier product", "vendor item"],
    ),
    relationship(
      "Supplier -> Invoice",
      90,
      "Supplier",
      "Invoice",
      ["Supplier"],
      ["Invoice"],
      ["supplier invoice", "vendor bill"],
    ),
    relationship(
      "Product -> Category",
      100,
      "Product",
      "Category",
      ["Product Name", "SKU"],
      ["Category"],
      ["product category"],
    ),
    relationship(
      "Product -> Brand",
      110,
      "Product",
      "Brand",
      ["Product Name", "SKU"],
      ["Brand"],
      ["product brand"],
    ),
    relationship(
      "Product -> Warehouse",
      120,
      "Product",
      "Warehouse",
      ["Product Name", "SKU"],
      ["Warehouse"],
      ["product warehouse"],
    ),
    relationship(
      "Warehouse -> Inventory",
      130,
      "Warehouse",
      "Inventory Item",
      ["Warehouse"],
      ["Inventory", "Quantity"],
      ["warehouse inventory"],
    ),
    relationship(
      "Store -> Inventory",
      140,
      "Store",
      "Inventory Item",
      ["Store"],
      ["Inventory", "Quantity"],
      ["store inventory"],
    ),
    relationship(
      "Store -> Employee",
      150,
      "Store",
      "Employee",
      ["Store"],
      ["Employee"],
      ["store employee"],
    ),
    relationship(
      "Employee -> Department",
      160,
      "Employee",
      "Department",
      ["Employee"],
      ["Department"],
      ["employee department", "staff team"],
    ),
    relationship("Invoice -> Tax", 170, "Invoice", "Tax", ["Invoice"], ["Tax"], ["invoice tax"]),
    relationship(
      "Invoice -> Currency",
      180,
      "Invoice",
      "Currency",
      ["Invoice"],
      ["Currency"],
      ["invoice currency"],
    ),
    relationship(
      "Expense -> Department",
      190,
      "Expense",
      "Department",
      ["Expense"],
      ["Department"],
      ["department expense"],
    ),
    relationship(
      "Project -> Employee",
      200,
      "Project",
      "Employee",
      ["Department", "Status"],
      ["Employee"],
      ["project employee"],
    ),
    relationship(
      "Project -> Expense",
      210,
      "Project",
      "Expense",
      ["Department", "Status"],
      ["Expense"],
      ["project expense"],
    ),
    relationship(
      "Shipment -> Order",
      220,
      "Shipment",
      "Order",
      ["Status", "Date"],
      ["Order"],
      ["shipment order"],
    ),
    relationship(
      "Shipment -> Carrier",
      230,
      "Shipment",
      "Carrier",
      ["Status", "Date"],
      ["Supplier"],
      ["shipment carrier"],
    ),
    relationship(
      "Refund -> Invoice",
      240,
      "Refund",
      "Invoice",
      ["Payment", "Revenue"],
      ["Invoice"],
      ["refund invoice"],
    ),
    relationship(
      "Subscription -> Customer",
      250,
      "Subscription",
      "Customer",
      ["Payment", "Status"],
      ["Customer"],
      ["subscription customer"],
    ),
    relationship(
      "Asset -> Department",
      260,
      "Asset",
      "Department",
      ["Expense"],
      ["Department"],
      ["asset department"],
    ),
  ],
  plugins: [],
};

export function createDefaultRelationshipRegistry(): DefaultRelationshipRegistry {
  return new DefaultRelationshipRegistry();
}

function relationship(
  relationshipType: RelationshipType,
  priority: number,
  sourceEntity: Exclude<EntityType, "Unknown">,
  targetEntity: Exclude<EntityType, "Unknown">,
  sourceSemanticCategories: SemanticCategory[],
  targetSemanticCategories: SemanticCategory[],
  aliases: string[],
): RelationshipRegistryEntry {
  return {
    relationshipType,
    version: "1.0.0",
    priority,
    sourceEntity,
    targetEntity,
    sourceSemanticCategories,
    targetSemanticCategories,
    requiredSignals: 3,
    aliases,
    metadata: { extensible: true },
  };
}
