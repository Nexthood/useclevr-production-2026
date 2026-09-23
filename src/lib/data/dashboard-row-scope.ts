// The Dashboard KPI row and the World Map must describe the same active
// dataset scope. When semantic profile metrics drive the KPI row, they are
// computed from every stored row of the active dataset (no date window), so
// the World Map aggregates that same full row scope. When the page-level
// fallback KPIs drive the row, both sides use the range-filtered rows.
// Geographic column filtering still decides separately whether a row can be
// mapped; it never re-scopes the aggregated rows.
export function selectDashboardRegionRows<T>(input: {
  rows: T[]
  activeRows: T[]
  semanticDrivesKpis: boolean
}): T[] {
  return input.semanticDrivesKpis ? input.rows : input.activeRows
}
