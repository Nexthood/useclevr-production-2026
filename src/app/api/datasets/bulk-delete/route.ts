import { handleBulkDeleteDatasetsRequest } from "@/lib/data/delete-datasets-api"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return handleBulkDeleteDatasetsRequest(request)
}
