import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  // Fetch the homepage HTML directly
  const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : "http://localhost:8080"

  try {
    const response = await fetch(`${baseUrl}/`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    })

    const html = await response.text()

    const analysis = {
      statusCode: response.status,
      contentType: response.headers.get("content-type"),
      contentLength: response.headers.get("content-length"),
      hasDoctype: html.includes("<!DOCTYPE"),
      hasHtmlTag: html.includes("<html"),
      hasBodyTag: html.includes("<body"),
      htmlLength: html.length,
      firstChars: html.substring(0, 200),
      lastChars: html.substring(Math.max(0, html.length - 200)),
      allHeaders: Object.fromEntries(response.headers.entries()),
    }

    return NextResponse.json({ analysis, htmlPreview: html.substring(0, 2000) })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
