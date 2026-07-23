export type RetailKpiOrder = {
  status: string | null;
  currency: string | null;
  totalAmount: string | number | null;
  discountAmount: string | number | null;
  refundAmount: string | number | null;
  taxAmount: string | number | null;
  tipAmount: string | number | null;
};

export type RetailKpiResult = {
  currency: string;
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  taxes: number;
  tips: number;
  completedOrders: number;
  averageOrderValue: number | null;
  warnings: string[];
};

const completedStatuses = new Set(["COMPLETED", "OPEN", "FULFILLED"]);

export function calculateRetailSalesKpis(orders: RetailKpiOrder[]): RetailKpiResult[] {
  const groups = new Map<string, RetailKpiOrder[]>();
  for (const order of orders) {
    const currency = order.currency || "UNKNOWN";
    groups.set(currency, [...(groups.get(currency) || []), order]);
  }

  return [...groups.entries()].map(([currency, rows]) => {
    const included = rows.filter((order) => !order.status || completedStatuses.has(order.status));
    const grossSales: number = sum(included.map((order) => order.totalAmount));
    const discounts: number = sum(included.map((order) => order.discountAmount));
    const refunds: number = sum(included.map((order) => order.refundAmount));
    const taxes: number = sum(included.map((order) => order.taxAmount));
    const tips: number = sum(included.map((order) => order.tipAmount));
    const netSales = grossSales - discounts - refunds;
    return {
      currency,
      grossSales: roundMoney(grossSales),
      discounts: roundMoney(discounts),
      refunds: roundMoney(refunds),
      netSales: roundMoney(netSales),
      taxes: roundMoney(taxes),
      tips: roundMoney(tips),
      completedOrders: included.length,
      averageOrderValue: included.length ? roundMoney(netSales / included.length) : null,
      warnings: currency === "UNKNOWN" ? ["Currency is missing for one or more orders."] : [],
    };
  });
}

export function calculateStockoutRisk(input: {
  availableInventory: number | null;
  unitsSold: number;
  activeSalesDays: number;
}) {
  if (input.availableInventory === null) return { category: "insufficient_data", daysRemaining: null };
  if (input.activeSalesDays <= 0 || input.unitsSold <= 0) {
    return { category: "zero_sales", daysRemaining: null };
  }
  const averageDailySales = input.unitsSold / input.activeSalesDays;
  if (averageDailySales <= 0) return { category: "zero_sales", daysRemaining: null };
  const daysRemaining = input.availableInventory / averageDailySales;
  if (daysRemaining <= 3) return { category: "critical", daysRemaining };
  if (daysRemaining <= 7) return { category: "high", daysRemaining };
  if (daysRemaining <= 14) return { category: "medium", daysRemaining };
  return { category: "low", daysRemaining };
}

export function calculateReorderQuantity(input: {
  averageDailySales: number;
  coverageDays: number;
  safetyStock: number;
  availableStock: number;
  incomingStock: number;
}) {
  const targetStock = input.averageDailySales * input.coverageDays;
  return Math.max(0, Math.ceil(targetStock + input.safetyStock - input.availableStock - input.incomingStock));
}

function sum(values: Array<string | number | null>) {
  return values.reduce<number>((total, value) => total + toNumber(value), 0);
}

function toNumber(value: string | number | null) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
