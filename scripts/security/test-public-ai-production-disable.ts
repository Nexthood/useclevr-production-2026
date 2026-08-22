import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "../..")

function readProjectFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8")
}

function getFunctionBody(source: string, name: string) {
  const start = source.indexOf(`export async function ${name}`)
  assert.notEqual(start, -1, `${name} handler exists`)
  const nextExport = source.indexOf("export async function", start + 1)
  return source.slice(start, nextExport === -1 ? source.length : nextExport)
}

function assertGuardBefore(body: string, laterText: string, message: string) {
  const guardIndex = body.indexOf("const disabledResponse = disabledInProductionResponse();")
  const laterIndex = body.indexOf(laterText)
  assert.ok(guardIndex !== -1, `${message}: production guard exists`)
  assert.ok(laterIndex !== -1, `${message}: expected guarded code exists`)
  assert.ok(guardIndex < laterIndex, `${message}: production guard runs first`)
}

function main() {
  const route = readProjectFile("src/app/api/public/ai/route.ts")
  assert.ok(route.includes("process.env.NODE_ENV !== 'production'"), "route checks NODE_ENV production")
  assert.ok(route.includes("NextResponse.json({ error: 'Not found' }, { status: 404 })"), "production response is a generic 404")
  assert.equal(route.includes("PUBLIC_AI_API_ENABLED"), false, "production disable is not controlled by a launch flag")

  const postBody = getFunctionBody(route, "POST")
  assertGuardBefore(postBody, "request.headers.get('x-api-key')", "POST")
  assertGuardBefore(postBody, "request.json()", "POST")
  assertGuardBefore(postBody, "handleAnalyze(body)", "POST")
  assertGuardBefore(postBody, "handleInvestigate(body)", "POST")
  assertGuardBefore(postBody, "handlePredict(body)", "POST")
  assertGuardBefore(postBody, "handleCompare(body)", "POST")

  const getBody = getFunctionBody(route, "GET")
  assertGuardBefore(getBody, "UseClevr AI Data API", "GET")
  assertGuardBefore(getBody, "authentication", "GET")
  assertGuardBefore(getBody, "analyze", "GET")

  const genericResponse = route.match(/NextResponse\.json\(\{ error: 'Not found' \}, \{ status: 404 \}\)/)?.[0] || ""
  for (const forbidden of ["x-api-key", "useclevr_", "analyze", "investigate", "predict", "compare", "UseClevr AI Data API"]) {
    assert.equal(
      genericResponse.includes(forbidden),
      false,
      `generic production 404 response does not reveal ${forbidden}`,
    )
  }
}

main()
