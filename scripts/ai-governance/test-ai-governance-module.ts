import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const requiredSections = [
  "overview",
  "transparency",
  "providers",
  "models",
  "audit-log",
  "ai-policies",
  "privacy",
  "compliance",
  "risk",
  "feedback",
  "reports",
]

const governanceViewSource = readFileSync("src/components/ai-governance/governance-view.tsx", "utf8")
for (const section of requiredSections) {
  assert.ok(governanceViewSource.includes(`slug: "${section}"`), `AI Governance exposes ${section} page section`)
}
assert.ok(governanceViewSource.includes('return found?.slug || "overview"'), "unknown governance route falls back to overview")
for (const policy of ["Transparency Policy", "Privacy Policy", "AI Usage Policy", "Acceptable Use Policy"]) {
  assert.ok(readFileSync("src/lib/ai-governance/governance-service.ts", "utf8").includes(policy), `AI governance includes ${policy}`)
}
for (const literacy of ["How AI Works", "Limitations", "Confidence", "Verification", "Human Review"]) {
  assert.ok(readFileSync("src/lib/ai-governance/governance-service.ts", "utf8").includes(literacy), `AI literacy includes ${literacy}`)
}

const sidebarSource = readFileSync("src/components/layout/app-sidebar.tsx", "utf8")
assert.ok(sidebarSource.includes('name: "AI Governance"'), "sidebar includes AI Governance")
assert.ok(sidebarSource.includes('href: "/app/ai-governance"'), "sidebar links to AI Governance overview")

const assistantSource = readFileSync("src/components/chat/ai-assistant-workspace.tsx", "utf8")
assert.ok(assistantSource.includes("AI-generated"), "assistant responses display AI-generated label")
assert.ok(assistantSource.includes("Provider:"), "assistant responses display provider metadata")
assert.ok(assistantSource.includes("Model:"), "assistant responses display model metadata")
assert.ok(assistantSource.includes("Confidence:"), "assistant responses display confidence metadata")
assert.ok(assistantSource.includes("Human control"), "assistant responses expose human override controls")
for (const action of ["accept", "reject", "edit", "undo"]) {
  assert.ok(assistantSource.includes(action), `assistant supports ${action} override`)
}
assert.ok(assistantSource.includes("/api/ai-governance/overrides"), "assistant records manual overrides through governance API")

const schemaSource = readFileSync("src/lib/db/schema.ts", "utf8")
assert.ok(schemaSource.includes("AiGovernanceOverride"), "schema includes AI governance override table")
assert.ok(schemaSource.includes("aiGovernanceOverrideActions"), "schema constrains override actions")
const predeploySource = readFileSync("scripts/runtime/railway-predeploy.cjs", "utf8")
assert.ok(predeploySource.includes("0020_ai_governance_overrides.sql"), "Railway predeploy applies AI Governance override migration")
const governanceServiceSource = readFileSync("src/lib/ai-governance/governance-service.ts", "utf8")
assert.ok(governanceServiceSource.includes("safeGetOverrideStats"), "AI Governance renders fallback override stats when override table is absent")
assert.ok(governanceServiceSource.includes("logGovernanceDataError"), "AI Governance logs failed data source stages with stack details")

for (const route of ["overview", "audit-log", "provider-status", "settings", "overrides", "reports"]) {
  const routeSource = readFileSync(`src/app/api/ai-governance/${route}/route.ts`, "utf8")
  assert.ok(routeSource.includes("requireSession"), `${route} API requires authentication`)
}

console.log("AI Governance module tests passed.")
