import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  analyzeSalesSegmentDeclines,
  isSalesSegmentDeclineQuestion,
} from "../../src/lib/data/segment-decline-analysis";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, "fixtures", "startup_saas_sales_dataset.csv");

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

function findFinding(result: ReturnType<typeof analyzeSalesSegmentDeclines>, dimension: string, segment: string) {
  assert.equal(result.ok, true);
  const finding = result.decliningSegments.find(
    (item) => item.dimension === dimension && item.segment === segment,
  );
  assert.ok(finding, `${dimension}:${segment} finding is present`);
  return finding;
}

const rows = parseFixtureCsv(fixturePath);
const columns = Object.keys(rows[0] ?? {});

assert.equal(
  isSalesSegmentDeclineQuestion("Which sales segments are declining?"),
  true,
  "declining sales segment intent is detected",
);

const result = analyzeSalesSegmentDeclines(rows, columns);
assert.equal(result.ok, true, "fixture produces deterministic decline analysis");

if (result.ok) {
  assert.equal(result.metric, "revenue", "revenue is selected as the sales metric");
  assert.equal(result.timeColumn, "order_date", "order_date is selected as the time column");
  assert.equal(result.periodComparison.previous, "March 2025", "March 2025 is the previous complete period");
  assert.equal(result.periodComparison.current, "April 2025", "April 2025 is the current complete period");
  assert.equal(result.periodComparison.ignoredLatestPeriod, "May 2025", "single-row May 2025 is ignored");
  assert.match(result.answer, /Direct data analysis/, "provider-independent direct analysis is labeled");
  assert.match(result.answer, /Seed: 38,441 -> 9,527, decline of 75\.2%/, "Seed decline uses full values");
  assert.match(result.answer, /Pro: 4,998 -> 3,822, decline of 23\.5%/, "Pro decline uses full values");
  assert.match(result.answer, /Enterprise: 56,810 -> 51,428, decline of 9\.5%/, "Enterprise decline uses full values");
  assert.match(result.answer, /Referral: 8,501 -> 4,302, decline of 49\.4%/, "Referral decline uses full values");
  assert.match(result.answer, /Organic: 16,396 -> 8,767, decline of 46\.5%/, "Organic decline uses full values");
  assert.match(result.answer, /LinkedIn Ads: 12,689 -> 8,372, decline of 34\.0%/, "LinkedIn Ads decline uses full values");

  const seed = findFinding(result, "startup_stage", "Seed");
  assert.equal(seed.previousValue, 38441);
  assert.equal(seed.currentValue, 9527);
  assert.equal(seed.changePercent, -75.2);

  const pro = findFinding(result, "plan", "Pro");
  assert.equal(pro.previousValue, 4998);
  assert.equal(pro.currentValue, 3822);
  assert.equal(pro.changePercent, -23.5);

  const enterprise = findFinding(result, "plan", "Enterprise");
  assert.equal(enterprise.previousValue, 56810);
  assert.equal(enterprise.currentValue, 51428);
  assert.equal(enterprise.changePercent, -9.5);

  const referral = findFinding(result, "acquisition_channel", "Referral");
  assert.equal(referral.previousValue, 8501);
  assert.equal(referral.currentValue, 4302);
  assert.equal(referral.changePercent, -49.4);

  const organic = findFinding(result, "acquisition_channel", "Organic");
  assert.equal(organic.previousValue, 16396);
  assert.equal(organic.currentValue, 8767);
  assert.equal(organic.changePercent, -46.5);

  const linkedIn = findFinding(result, "acquisition_channel", "LinkedIn Ads");
  assert.equal(linkedIn.previousValue, 12689);
  assert.equal(linkedIn.currentValue, 8372);
  assert.equal(linkedIn.changePercent, -34);
}

const missingMetric = analyzeSalesSegmentDeclines(
  rows.map(({ revenue: _revenue, ...row }) => row),
);
assert.equal(missingMetric.ok, false);
if (!missingMetric.ok) assert.equal(missingMetric.code, "missing_sales_metric");

const missingTime = analyzeSalesSegmentDeclines(
  rows.map(({ order_date: _orderDate, ...row }) => row),
);
assert.equal(missingTime.ok, false);
if (!missingTime.ok) assert.equal(missingTime.code, "missing_time_dimension");

const missingSegment = analyzeSalesSegmentDeclines(
  rows.map(({ startup_stage: _stage, plan: _plan, acquisition_channel: _channel, region: _region, country: _country, ...row }) => row),
);
assert.equal(missingSegment.ok, false);
if (!missingSegment.ok) assert.equal(missingSegment.code, "missing_segment_dimension");

process.stdout.write("ok - startup_saas_sales_dataset declining segment analysis\n");
