import { NextResponse } from "next/server"
import { createReadStream, statSync, existsSync } from "fs"
import { join } from "path"

const FILE_NAME = "UseClevr-Hybrid-Runtime-Setup.exe"
const FILE_PATH = join(process.cwd(), "public-downloads", FILE_NAME)

export async function HEAD() {
  try {
    if (!existsSync(FILE_PATH)) {
      return new Response(null, { status: 404 })
    }
    const stats = statSync(FILE_PATH)
    return new Response(null, {
      status: 200,
      headers: {
        "Content-Length": String(stats.size),
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${FILE_NAME}"`,
        "Cache-Control": "public, max-age=60",
      },
    })
  } catch {
    return new Response(null, { status: 500 })
  }
}

export async function GET() {
  try {
    if (!existsSync(FILE_PATH)) {
      return NextResponse.json({ available: false, error: "not_found" }, { status: 404 })
    }
    const stats = statSync(FILE_PATH)
    const stream = createReadStream(FILE_PATH)
    return new Response(stream as unknown as ReadableStream, {
      status: 200,
      headers: {
        "Content-Length": String(stats.size),
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${FILE_NAME}"`,
        "Cache-Control": "public, max-age=60",
      },
    })
  } catch {
    return NextResponse.json({ available: false, error: "server_error" }, { status: 500 })
  }
}
