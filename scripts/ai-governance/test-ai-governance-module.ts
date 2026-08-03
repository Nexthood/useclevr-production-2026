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
assert.ok(governanceViewSource.includes("max-w-[1360px]"), "AI Governance uses a centered production content width")
assert.ok(governanceViewSource.includes("Export compliance report"), "AI Governance header includes compliance report export")
assert.ok(governanceViewSource.includes("Configure AI"), "AI Governance header includes provider configuration action")
assert.ok(governanceViewSource.includes("Refresh status"), "AI Governance header includes status refresh action")
assert.ok(governanceViewSource.includes("aria-current"), "AI Governance segmented navigation exposes the active page")
assert.ok(governanceViewSource.includes("Compliance readiness"), "AI Governance overview includes readiness context")
assert.ok(governanceViewSource.includes("Control matrix"), "AI Governance overview includes the control matrix")
assert.ok(governanceViewSource.includes("AI-generated response"), "AI Governance overview includes the AI transparency example")
assert.ok(governanceViewSource.includes("Report center"), "AI Governance reports page is presented as a report center")
assert.ok(governanceViewSource.includes("No AI requests recorded"), "AI Governance renders useful empty states")
for (const policy of ["Transparency Policy", "Privacy Policy", "AI Usage Policy", "Acceptable Use Policy"]) {
  assert.ok(readFileSync("src/lib/ai-governance/governance-service.ts", "utf8").includes(policy), `AI governance includes ${policy}`)
}
for (const literacy of ["How AI Works", "Limitations", "Confidence", "Verification", "Human Review"]) {
  assert.ok(readFileSync("src/lib/ai-governance/governance-service.ts", "utf8").includes(literacy), `AI literacy includes ${literacy}`)
}

const sidebarSource = readFileSync("src/components/layout/app-sidebar.tsx", "utf8")
assert.ok(sidebarSource.includes('name: "AI Governance"'), "sidebar includes AI Governance")
assert.ok(sidebarSource.includes('href: "/app/ai-governance"'), "sidebar links to AI Governance overview")
assert.ok(sidebarSource.includes("const aiNavigation"), "sidebar groups AI Assistant and AI Governance")
assert.ok(sidebarSource.includes("const adminAiNavigation"), "sidebar groups admin AI tools")
assert.ok(sidebarSource.includes('label="AI"'), "sidebar renders a dedicated AI section label")
for (const item of ["AI Assistant", "AI Governance", "AI Traces", "AI Benchmarking", "AI Cost Optimizer"]) {
  assert.ok(sidebarSource.includes(`name: "${item}"`), `AI sidebar group includes ${item}`)
}

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
for (const migration of [
  "0004_byoai_provider_config.sql",
  "0005_ai_provider_manager.sql",
  "0006_ai_provider_priority.sql",
  "0007_ai_request_audit_logs.sql",
  "0016_byok_provider_audit_metadata.sql",
  "0021_ai_governance_fresh_install_support.sql",
  "0020_ai_governance_overrides.sql",
]) {
  assert.ok(predeploySource.includes(migration), `Railway predeploy applies ${migration}`)
}
assert.ok(
  predeploySource.indexOf("0021_ai_governance_fresh_install_support.sql") <
    predeploySource.indexOf("0020_ai_governance_overrides.sql"),
  "Railway predeploy creates AI interaction traces before governance overrides reference them",
)
assert.ok(predeploySource.includes("0020_ai_governance_overrides.sql"), "Railway predeploy applies AI Governance override migration")
const governanceServiceSource = readFileSync("src/lib/ai-governance/governance-service.ts", "utf8")
assert.ok(governanceServiceSource.includes("safeGetOverrideStats"), "AI Governance renders fallback override stats when override table is absent")
assert.ok(governanceServiceSource.includes("snapshot-build"), "AI Governance has a top-level snapshot render fallback")
assert.ok(governanceServiceSource.includes("logGovernanceDataError"), "AI Governance logs failed data source stages with stack details")
const freshInstallMigration = readFileSync("src/lib/db/migrations/0021_ai_governance_fresh_install_support.sql", "utf8")
assert.ok(freshInstallMigration.includes('CREATE TABLE IF NOT EXISTS "AiInteractionTrace"'), "fresh install migration creates AI interaction traces")

for (const route of ["overview", "audit-log", "provider-status", "settings", "overrides", "reports"]) {
  const routeSource = readFileSync(`src/app/api/ai-governance/${route}/route.ts`, "utf8")
  assert.ok(routeSource.includes("requireSession"), `${route} API requires authentication`)
}

console.log("AI Governance module tests passed.")
