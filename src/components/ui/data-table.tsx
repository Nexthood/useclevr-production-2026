import { Table2 } from "lucide-react"

// Intentional placeholder for a future reusable data table component.
export function DataTableComingSoon() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
      <div className="flex items-center gap-2 font-medium text-foreground">
        <Table2 className="h-4 w-4" />
        Data table
      </div>
      <p className="mt-1">Reusable interactive tables are coming soon.</p>
    </div>
  )
}
