import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: datasets, error } = await supabase
      .from("datasets")
      .select("id, name, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ datasets })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, fileName, fileSize, columns, rows } = body

    // Create dataset record
    const { data: dataset, error: datasetError } = await supabase
      .from("datasets")
      .insert({
        user_id: user.id,
        name: name || fileName,
      })
      .select("id, name, created_at")
      .single()

    if (datasetError) {
      return NextResponse.json({ error: datasetError.message }, { status: 500 })
    }

    // Insert rows in batches
    const batchSize = 100
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize).map((row: Record<string, unknown>, index: number) => ({
        dataset_id: dataset.id,
        row_index: i + index,
        data: row
      }))

      const { error: rowsError } = await supabase
        .from("dataset_rows")
        .insert(batch)

      if (rowsError) {
        // Rollback: delete the dataset if rows insertion fails
        await supabase.from("datasets").delete().eq("id", dataset.id)
        return NextResponse.json({ error: rowsError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ dataset })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
