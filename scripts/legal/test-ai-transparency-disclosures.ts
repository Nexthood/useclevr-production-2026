import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

function read(path: string) {
  return readFileSync(path, "utf8")
}

function sectionBody(source: string, title: string) {
  const pattern = new RegExp(`title: "${escapeRegExp(title)}",[\\s\\S]*?body: "([\\s\\S]*?)",\\n\\s*}`, "m")
  const match = source.match(pattern)
  assert.ok(match, `${title} section exists`)
  return match[1]
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const termsSource = read("src/app/(public)/terms/page.tsx")
const privacySource = read("src/app/(public)/privacy/page.tsx")
const disclaimerSource = read("src/components/chat/ai-accuracy-disclaimer.tsx")
const faqSource = read("src/lib/content/faq.ts")
const payloadSeedSource = read("src/lib/payload/seed.ts")
const payloadContentSource = read("src/lib/payload/content.ts")
const salesPlanSource = read("docs/Sales/sales-plan.md")
const salesOnePagerSource = read("docs/Sales/sales-one-pager.md")

const termsAi = sectionBody(termsSource, "AI-Generated Content Disclaimer")
assert.match(termsAi, /UseClevr identifies AI-assisted interactions and outputs where appropriate/, "Terms Section 4 identifies AI-assisted output")
assert.match(termsAi, /AI-generated or AI-assisted outputs may contain errors/, "Terms Section 4 discloses AI errors")
assert.match(termsAi, /deterministic calculations with AI-generated interpretation/, "Terms Section 4 distinguishes deterministic calculations from AI interpretation")
assert.match(termsAi, /confidence indicators, evidence, source information, or calculation sources does not guarantee/, "Terms Section 4 preserves evidence while avoiding guarantees")
assert.match(termsAi, /material business, financial, accounting, tax, legal, compliance, investment, or operational decisions/, "Terms Section 4 covers material decisions")
assert.match(termsAi, /professional legal, tax, accounting, financial, medical, investment, employment, compliance, or operational advice/, "Terms Section 4 preserves professional advice limitation")

const termsIp = sectionBody(termsSource, "Intellectual Property")
assert.match(termsIp, /uploading data does not transfer dataset ownership to UseClevr/, "Terms dataset ownership language is explicit")
assert.match(termsIp, /host, process, analyze, secure, transmit where necessary, display, back up, generate requested outputs from, and support/, "Terms has limited processing-rights language")

const privacyDatasets = sectionBody(privacySource, "Uploaded Datasets")
assert.match(privacyDatasets, /Uploading a dataset does not transfer ownership/, "Privacy dataset ownership language is explicit")
assert.match(privacyDatasets, /host, process, analyze, secure, transmit where necessary, display, generate requested outputs/, "Privacy has limited processing-purpose language")

const privacyAi = sectionBody(privacySource, "AI Processing")
assert.match(privacyAi, /configured AI providers, cloud AI, or local\/private provider routing/, "Privacy Section 7 covers provider routing")
assert.match(privacyAi, /processing may occur locally, through UseClevr systems, or through providers located in different countries/, "Privacy Section 7 covers variable processing location")
assert.match(privacyAi, /limited context needed for the requested functionality/, "Privacy Section 7 avoids claiming all raw rows are always sent")
assert.match(privacyAi, /derived dataset context, summaries, column profiles, calculated metrics, bounded samples/, "Privacy Section 7 describes derived dataset context")
assert.match(privacyAi, /Deterministic calculations may remain backend-side where applicable/, "Privacy Section 7 covers deterministic backend calculations")
assert.match(privacyAi, /AI outputs may contain errors/, "Privacy Section 7 discloses AI output errors without becoming a liability section")
assert.match(privacyAi, /provider's service, privacy, security, and data-processing arrangements/, "Privacy Section 7 references provider arrangements")

assert.match(disclaimerSource, /UseClevr AI can make mistakes\. Verify important business and financial information\./, "Shared AI disclaimer keeps exact approved wording")
assert.doesNotMatch(disclaimerSource, /WARNING|DANGER|DO NOT TRUST AI/, "Shared AI disclaimer avoids alarming wording")

const combinedCurrentSources = [
  termsSource,
  privacySource,
  disclaimerSource,
  faqSource,
  payloadSeedSource,
  payloadContentSource,
  salesPlanSource,
  salesOnePagerSource,
].join("\n")
assert.doesNotMatch(combinedCurrentSources, /EU AI Act compliant|Certified under the EU AI Act|EU-approved AI|Fully compliant AI|compliant AI/i, "No unsupported EU AI Act compliance claim is introduced")
assert.doesNotMatch(combinedCurrentSources, /AI receives only aggregated metrics, never raw rows|AI receives only aggregated metrics, never raw row data|GDPR-compliant Neon/i, "Collateral avoids overbroad AI/data hosting claims")
assert.doesNotMatch(faqSource + payloadSeedSource, /UseClevr is GDPR-compliant/, "Public FAQ avoids unsupported compliance shorthand")
assert.match(termsSource, /reviewed by a qualified legal professional before large-scale commercial launch/, "Terms preserve pre-launch legal review notice")
assert.match(privacySource, /reviewed by a qualified legal professional before large-scale commercial launch/, "Privacy preserves pre-launch legal review notice")

console.log("AI transparency legal disclosure tests passed.")
