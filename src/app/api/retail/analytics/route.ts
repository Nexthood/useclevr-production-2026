import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { getOwnedRetailConnection } from "@/integrations/retail/core/connection.service";
import { loadSquareRetailAnalytics } from "@/integrations/retail/analytics/square-analytics.service";
import { getDb } from "@/lib/db";
import { datasetRows, datasets } from "@/lib/db/schema";
import { buildDatasetRetailSnapshot, parseRetailSourceRef } from "@/lib/retail/retail-snapshot";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Normalized Retail analytics for a user-selected source.
 *
 * `?source=dataset:<datasetId>` analyzes an owned uploaded retail dataset.
 * `?source=square:<connectionId>` analyzes an owned synchronized Square
 * connection. Source ownership is resolved server-side on every request, so
 * a manipulated dataset or connection ID can never cross tenants.
 */
export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const sourceParam = new URL(request.url).searchParams.get("source");
  const sourceRef = parseRetailSourceRef(sourceParam);
  if (!sourceRef) {
    return NextResponse.json({ error: "A valid retail data source is required." }, { status: 400 });
  }

  try {
    if (sourceRef.type === "dataset") {
      const dataset = await db.query.datasets.findFirst({
        where: and(eq(datasets.id, sourceRef.datasetId), eq(datasets.userId, userId)),
      });
      if (!dataset) {
        return NextResponse.json({ error: "Retail source not found." }, { status: 404 });
      }

      let rows = (dataset.data as Record<string, unknown>[] | null) || [];
      if (rows.length === 0) {
        const storedRows = await db.query.datasetRows.findMany({
          where: eq(datasetRows.datasetId, dataset.id),
          columns: { data: true },
          orderBy: (rows, { asc }) => [asc(rows.rowIndex)],
        });
        rows = storedRows.map((row) => row.data as Record<string, unknown>);
      }

      const columns = (dataset.columns as string[] | null) || Object.keys(rows[0] || {});
      const snapshot = buildDatasetRetailSnapshot({
        datasetId: dataset.id,
        name: dataset.name,
        fileName: dataset.fileName,
        rowCount: dataset.rowCount || rows.length,
        columnCount: dataset.columnCount || columns.length,
        createdAt: dataset.createdAt,
        columns,
        rows,
      });
      return NextResponse.json({ snapshot }, { headers: { "Cache-Control": "no-store" } });
    }

    const connection = await getOwnedRetailConnection({ userId, connectionId: sourceRef.connectionId });
    if (!connection) {
      return NextResponse.json({ error: "Retail source not found." }, { status: 404 });
    }

    const snapshot = await loadSquareRetailAnalytics(connection);
    return NextResponse.json({ snapshot }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Retail analytics could not be loaded.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
