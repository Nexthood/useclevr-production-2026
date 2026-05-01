import { createReadStream, existsSync, statSync } from "node:fs"
import { extname, relative, resolve } from "node:path"
import { Readable } from "node:stream"
import { NextResponse } from "next/server"

const ASSETS_DIR = resolve(process.cwd(), "assets")

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
}

type Params = {
  params: Promise<{
    path?: string[]
  }>
}

export async function GET(_request: Request, { params }: Params) {
  const { path = [] } = await params
  const filePath = resolve(ASSETS_DIR, ...path)
  const relativePath = relative(ASSETS_DIR, filePath)

  if (relativePath.startsWith("..") || relativePath === "" || !existsSync(filePath)) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 })
  }

  const stats = statSync(filePath)

  if (!stats.isFile()) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 })
  }

  const stream = Readable.toWeb(createReadStream(filePath))
  const extension = extname(filePath).toLowerCase()

  return new Response(stream as ReadableStream, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(stats.size),
      "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
    },
  })
}
