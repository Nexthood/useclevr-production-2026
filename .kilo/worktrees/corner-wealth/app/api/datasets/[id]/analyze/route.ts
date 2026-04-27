import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get dataset
    const { data: dataset, error: datasetError } = await supabase
      .from("datasets")
      .select("id, name, created_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (datasetError) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 })
    }

    // Get all rows for analysis
    const { data: rows, error: rowsError } = await supabase
      .from("dataset_rows")
      .select("data")
      .eq("dataset_id", id)
      .order("row_index", { ascending: true })

    if (rowsError) {
      return NextResponse.json({ error: rowsError.message }, { status: 500 })
    }

    const data = rows.map(r => r.data)
    // Derive columns from first row
    const columns = data.length > 0 ? Object.keys(data[0] as object) : []
    const rowCount = data.length

    // Analyze each column
    const columnStats: Record<string, {
      type: string
      unique: number
      nullCount: number
      min?: number | string
      max?: number | string
      mean?: number
      sum?: number
    }> = {}

    for (const column of columns) {
      const values = data.map(row => row[column]).filter(v => v !== null && v !== undefined && v !== "")
      const nullCount = data.length - values.length
      const unique = new Set(values).size

      // Detect type
      const numericValues = values.filter(v => !isNaN(Number(v))).map(v => Number(v))
      const isNumeric = numericValues.length > values.length * 0.8 && numericValues.length > 0

      if (isNumeric) {
        const sum = numericValues.reduce((a, b) => a + b, 0)
        const mean = sum / numericValues.length
        const min = Math.min(...numericValues)
        const max = Math.max(...numericValues)

        columnStats[column] = {
          type: "numeric",
          unique,
          nullCount,
          min,
          max,
          mean: Math.round(mean * 100) / 100,
          sum: Math.round(sum * 100) / 100
        }
      } else {
        const sortedValues = [...values].sort()
        columnStats[column] = {
          type: "text",
          unique,
          nullCount,
          min: sortedValues[0],
          max: sortedValues[sortedValues.length - 1]
        }
      }
    }

    // Generate summary
    const summary = {
      totalRows: rowCount,
      totalColumns: columns.length,
      columns: columnStats,
      sampleData: data.slice(0, 5)
    }

    return NextResponse.json({ analysis: summary })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
