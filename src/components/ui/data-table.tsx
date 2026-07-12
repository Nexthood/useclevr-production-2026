import * as React from "react"

export interface DataTableColumn<T extends Record<string, unknown>> {
  key: keyof T | string
  header: React.ReactNode
  align?: "left" | "right" | "center"
  render?: (row: T, rowIndex: number) => React.ReactNode
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: DataTableColumn<T>[]
  rows: T[]
  title?: string
  description?: string
  emptyMessage?: string
  rowKey?: (row: T, rowIndex: number) => React.Key
  minWidth?: string
  selectable?: boolean
  selectedRows?: Set<string>
  onSelectedRowsChange?: (selectedRows: Set<string>) => void
  bulkActions?: React.ReactNode
  actions?: React.ReactNode
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === "") return "-"
  if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (value instanceof Date) return value.toLocaleDateString()
  return String(value)
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  title,
  description,
  emptyMessage = "No rows to display.",
  rowKey,
  minWidth = "min-w-full",
  selectable = false,
  selectedRows = new Set<string>(),
  onSelectedRowsChange,
  bulkActions,
  actions,
}: DataTableProps<T>) {
  const [localSelectedRows, setLocalSelectedRows] = React.useState<Set<string>>(new Set<string>())
  const activeSelectedRows = onSelectedRowsChange ? selectedRows : localSelectedRows
  const setActiveSelectedRows = onSelectedRowsChange || setLocalSelectedRows
  const selectAllRef = React.useRef<HTMLInputElement | null>(null)
  const rowIds = React.useMemo(
    () => rows.map((row, rowIndex) => String(rowKey?.(row, rowIndex) || rowIndex)),
    [rows, rowKey],
  )
  const visibleSelectedCount = rowIds.filter((id) => activeSelectedRows.has(id)).length

  React.useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = visibleSelectedCount > 0 && visibleSelectedCount < rows.length
    }
  }, [rows.length, visibleSelectedCount])

  React.useEffect(() => {
    const visibleIds = new Set(rowIds)
    const next = new Set(Array.from(activeSelectedRows).filter((id) => visibleIds.has(id)))
    if (next.size !== activeSelectedRows.size) {
      setActiveSelectedRows(next)
    }
  }, [activeSelectedRows, rowIds, setActiveSelectedRows])

  const toggleRow = (row: T, rowIndex: number) => {
    const id = String(rowKey?.(row, rowIndex) || rowIndex)
    const next = new Set(activeSelectedRows)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setActiveSelectedRows(next)
  }

  const toggleAll = () => {
    if (rows.length > 0 && visibleSelectedCount === rows.length) {
      setActiveSelectedRows(new Set<string>())
    } else {
      setActiveSelectedRows(new Set(rowIds))
    }
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
      {(title || description || actions || bulkActions) && (
        <div className="border-b border-border/50 bg-muted/30 px-5 py-3.5">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
              {description && <p className="mt-1.5 text-xs text-muted-foreground/90 leading-relaxed">{description}</p>}
            </div>
            <div className="relative z-10 flex min-w-0 shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              {selectable && activeSelectedRows.size > 0 && (
                <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-md bg-muted/70 px-2 py-1 text-xs text-muted-foreground">
                  <span className="whitespace-nowrap">{visibleSelectedCount} selected</span>
                  {bulkActions}
                </div>
              )}
              {actions}
            </div>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className={`w-full ${minWidth} text-sm`}>
          <thead className="border-b border-border/50 bg-muted/40 text-muted-foreground">
            <tr>
              {selectable && (
                <th className="px-4 py-3 text-center">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    aria-label="Select all rows"
                    checked={rows.length > 0 && visibleSelectedCount === rows.length}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  scope="col"
                  className={[
                    "px-4 py-3 font-semibold tracking-tight",
                    column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left",
                  ].join(" ")}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-muted-foreground" colSpan={columns.length + (selectable ? 1 : 0)}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr key={rowKey?.(row, rowIndex) || rowIndex} className="border-b border-transparent transition-colors hover:bg-muted/50">
                  {selectable && (
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        aria-label={`Select row ${rowIndex + 1}`}
                        checked={activeSelectedRows.has(String(rowKey?.(row, rowIndex) || rowIndex))}
                        onChange={() => toggleRow(row, rowIndex)}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className={[
                        "px-4 py-3 align-middle text-foreground",
                        column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left",
                      ].join(" ")}
                    >
                      {column.render ? column.render(row, rowIndex) : formatCell(row[column.key])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
