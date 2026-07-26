import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildSegmentDeclinePresentation,
  type SegmentDeclineGroupName,
} from "../../src/components/chat/segment-decline-results";
import { analyzeSalesSegmentDeclines } from "../../src/lib/data/segment-decline-analysis";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const fixturePath = join(__dirname, "fixtures", "startup_saas_sales_dataset.csv");
const componentPath = join(repoRoot, "src", "components", "chat", "segment-decline-results.tsx");

function parseFixtureCsv(path: string) {
  const [headerLine, ...lines] = readFileSync(path, "utf8").trim().split(/\r?\n/);
  const headers = headerLine?.split(",") ?? [];
  return lines.map((line) => {
    const values = line.split(",");
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

const rows = parseFixtureCsv(fixturePath);
const analysis = analyzeSalesSegmentDeclines(rows, Object.keys(rows[0] ?? {}));
assert.equal(analysis.ok, true, "fixture still produces deterministic decline analysis");

if (analysis.ok) {
  const presentation = buildSegmentDeclinePresentation(analysis);
  const groupTitles = presentation.groups.map((group) => group.title);

  assert.deepEqual(
    groupTitles,
    ["Startup Stage", "Acquisition Channel", "Plan", "Geography"],
    "results are grouped by business dimension with geography last",
  );

  const startupStage = presentation.groups.find((group) => group.key === "Startup Stage");
  assert.equal(startupStage?.rows[0]?.segment, "Seed", "largest startup-stage decline appears first");
  assert.equal(startupStage?.rows[0]?.changePercent, -75.2, "startup-stage values remain unchanged");

  const acquisition = presentation.groups.find((group) => group.key === "Acquisition Channel");
  assert.deepEqual(
    acquisition?.rows.slice(0, 3).map((finding) => finding.segment),
    ["Referral", "Organic", "LinkedIn Ads"],
    "acquisition channel declines are sorted by largest percentage decline",
  );

  const plan = presentation.groups.find((group) => group.key === "Plan");
  assert.equal(plan?.rows[0]?.segment, "Pro", "weakest plan appears first");
  assert.equal(plan?.rows[0]?.changePercent, -23.5, "plan values remain unchanged");

  const geography = presentation.groups.find((group) => group.key === "Geography");
  assert.equal(geography?.visibleRows.length, 3, "default view shows at most three geography rows");
  assert.equal(geography?.hiddenCount, 1, "default view exposes hidden geography count for Show all");

  const expanded = buildSegmentDeclinePresentation(analysis, new Set<SegmentDeclineGroupName>(["Geography"]));
  const expandedGeography = expanded.groups.find((group) => group.key === "Geography");
  assert.equal(expandedGeography?.visibleRows.length, geography?.rows.length, "Show all reveals remaining geography rows");
  assert.equal(expandedGeography?.hiddenCount, 0, "expanded group has no hidden rows");

  assert.match(
    presentation.summary,
    /Seed startup stage declined the most at −75\.2%/,
    "executive summary uses deterministic startup-stage value",
  );
  assert.match(
    presentation.summary,
    /Referral and Organic were the weakest acquisition channels/,
    "executive summary names deterministic weakest acquisition channels",
  );
  assert.match(
    presentation.summary,
    /Pro was the weakest plan/,
    "executive summary names deterministic weakest plan",
  );

  const seed = presentation.tableRows.find((row) => row.dimension === "Startup Stage" && row.segment === "Seed");
  assert.equal(seed?.previousValue, 38441);
  assert.equal(seed?.currentValue, 9527);
  assert.equal(seed?.changePercent, -75.2);
}

const componentSource = readFileSync(componentPath, "utf8");
assert.match(componentSource, /max-w-full overflow-x-auto/, "result table scroll stays inside its panel");
assert.match(componentSource, /sticky top-0/, "result table uses a sticky header");
assert.match(componentSource, /md:grid-cols-2/, "desktop layout supports two grouped columns");
assert.match(componentSource, /grid min-w-0 gap-3/, "mobile layout stacks without page overflow");

process.stdout.write("ok - segment decline presentation\n");
