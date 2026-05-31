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
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
      {(title || description) && (
        <div className="border-b border-border px-4 py-3">
          {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className={`w-full ${minWidth} text-xs`}>
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  scope="col"
                  className={[
                    "px-3 py-2 font-medium",
                    column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left",
                  ].join(" ")}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={columns.length}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr key={rowKey?.(row, rowIndex) || rowIndex} className="hover:bg-muted/30">
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className={[
                        "px-3 py-2.5 align-middle text-foreground",
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
