import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { answerDatasetQuestionDeterministically } from "../../src/lib/data/dataset-assistant-deterministic";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

const rows = parseFixtureCsv("startup_saas_sales_dataset.csv");
const columns = Object.keys(rows[0] ?? {});

const proAnswer = answerDatasetQuestionDeterministically({
  question: "plan Pro?",
  datasetId: "fixture:startup-saas",
  datasetType: "standard",
  columns,
  rows,
});

assert.ok(proAnswer, "short plan question receives a deterministic dataset answer");
assert.match(proAnswer.answer, /Pro/, "answer references the requested Pro segment");
assert.match(proAnswer.answer, /8,821/, "answer includes the full grounded Pro revenue total");
assert.doesNotMatch(proAnswer.answer, /\$8,821/, "answer does not assume a currency when the dataset has none");
assert.doesNotMatch(proAnswer.answer, /2025-05/, "answer excludes sparse trailing May 2025 from comparable trend text");

const riskAnswer = answerDatasetQuestionDeterministically({
  question: "What are the biggest revenue risks?",
  datasetId: "fixture:startup-saas",
  datasetType: "standard",
  columns,
  rows,
});

assert.ok(riskAnswer, "revenue risk question receives a deterministic dataset answer");
assert.match(riskAnswer.answer, /2025-03 to 2025-04/, "risk answer compares complete March and April periods");
assert.doesNotMatch(riskAnswer.answer, /2025-05/, "risk answer excludes incomplete May period");
assert.equal(riskAnswer.result.intent, "revenue_risks");
assert.ok(riskAnswer.data.length > 0, "risk answer includes grounded preview rows");

const generalAnswer = answerDatasetQuestionDeterministically({
  question: "revenue growth?",
  datasetId: "fixture:startup-saas",
  datasetType: "standard",
  columns,
  rows,
});

assert.ok(generalAnswer, "short growth question receives a grounded response");
assert.match(generalAnswer.answer, /Revenue/, "growth answer summarizes revenue trend");

const datasetAssistantSource = readFileSync(join(repoRoot, "src", "components", "chat", "ai-assistant-workspace.tsx"), "utf8");
assert.match(datasetAssistantSource, /\/api\/hybrid-ai\/dataset-chat/, "Dataset AI frontend uses the dataset-chat API when a dataset is selected");
assert.match(datasetAssistantSource, /retryQuestion/, "Dataset AI preserves failed questions for retry");
assert.match(datasetAssistantSource, /Retry/, "Dataset AI renders a retry action");
assert.match(datasetAssistantSource, /Dataset assistant issue/, "Dataset AI renders a specific error title");
assert.match(datasetAssistantSource, /PROVIDER_TIMEOUT/, "Dataset AI classifies timeout errors");
assert.match(datasetAssistantSource, /PROVIDER_MISSING/, "Dataset AI classifies missing provider errors");
assert.match(datasetAssistantSource, /INVALID_PROVIDER_RESPONSE/, "Dataset AI classifies invalid provider responses");
assert.doesNotMatch(datasetAssistantSource, />\s*Analysis error\s*</, "Dataset AI does not render the old generic analysis error title");

const datasetRouteSource = readFileSync(join(repoRoot, "src", "app", "api", "hybrid-ai", "dataset-chat", "route.ts"), "utf8");
assert.match(datasetRouteSource, /answerDatasetQuestionDeterministically/, "Dataset AI route uses deterministic dataset answers before provider routing");
assert.match(datasetRouteSource, /datasetType: true/, "Dataset AI route loads the stored dataset type");
assert.match(datasetRouteSource, /DATASET_NOT_FOUND/, "Dataset AI route classifies missing or unauthorized datasets");
assert.match(datasetRouteSource, /EMPTY_DATASET/, "Dataset AI route classifies empty datasets");
assert.match(datasetRouteSource, /resolveDatasetAiProviderSettings/, "Dataset AI route wraps provider mode settings lookup");
assert.match(datasetRouteSource, /listDatasetAiProviders/, "Dataset AI route wraps saved provider lookup");
assert.match(datasetRouteSource, /generateDefaultCloudDatasetAnswer/, "Dataset AI route falls back to default cloud AI for provider-backed selected-dataset questions");
assert.match(datasetRouteSource, /createGoogleGenerativeAI\(\{ apiKey: geminiApiKey \}\)/, "Dataset AI default cloud fallback sends the resolved Gemini key explicitly");
assert.match(datasetRouteSource, /google\("gemini-2\.5-flash"\)/, "Dataset AI default cloud fallback sends a Gemini provider request");
assert.match(datasetRouteSource, /generateAntigravityCompletion/, "Dataset AI default cloud fallback uses the established Antigravity cloud provider path when direct Gemini env is absent");
assert.match(datasetRouteSource, /datasetId: input\.datasetId/, "Dataset AI default cloud audit preserves the selected dataset id");
assert.match(datasetRouteSource, /contextForClient\(input\.context\)/, "Dataset AI default cloud response returns selected dataset context");
assert.match(datasetRouteSource, /providerName: "Gemini Cloud"[\s\S]*route: "none"/, "Dataset AI reports default cloud provider failures without dropping selected dataset context");
assert.match(datasetRouteSource, /providerErrorDiagnostic/, "Dataset AI reports sanitized cloud provider diagnostics");

const usySource = readFileSync(join(repoRoot, "src", "components", "ui", "help-chatbox.tsx"), "utf8");
assert.match(usySource, /fetch\("\/api\/hybrid-ai\/chat"/, "Usy Bot keeps its separate chat API");
assert.doesNotMatch(usySource, /dataset-chat/, "Usy Bot does not route through the Dataset AI API");

process.stdout.write("ok - dataset AI assistant deterministic responses and Usy isolation\n");

function parseFixtureCsv(fileName: string) {
  const [headerLine, ...lines] = readFileSync(join(__dirname, "fixtures", fileName), "utf8").trim().split(/\r?\n/);
  const headers = headerLine?.split(",") ?? [];
  return lines.map((line) => {
    const values = line.split(",");
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}
