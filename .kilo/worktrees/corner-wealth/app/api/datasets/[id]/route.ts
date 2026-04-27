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

    // Get first 100 rows for preview
    const { data: rows, error: rowsError } = await supabase
      .from("dataset_rows")
      .select("data")
      .eq("dataset_id", id)
      .order("row_index", { ascending: true })
      .limit(100)

    if (rowsError) {
      return NextResponse.json({ error: rowsError.message }, { status: 500 })
    }

    // Derive columns from first row of data
    const data = rows.map(r => r.data)
    const columns = data.length > 0 ? Object.keys(data[0] as object) : []

    return NextResponse.json({ 
      dataset,
      rows: data,
      columns,
      totalRows: data.length
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
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

    const { error } = await supabase
      .from("datasets")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
