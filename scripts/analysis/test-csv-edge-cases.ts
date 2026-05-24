import { analyzeCSV, type DatasetRecord } from "../../src/lib/data/csv-analyzer";

const cases: Array<{ name: string; rows: DatasetRecord[]; expectRows: number }> = [
  {
    name: "empty upload",
    rows: [],
    expectRows: 0,
  },
  {
    name: "malformed sparse rows",
    rows: [
      { date: "2026-01-01", revenue: "100", country: "NL" },
      { date: "", revenue: "", country: null },
      { date: "not-a-date", revenue: "abc", extra: "kept" },
    ],
    expectRows: 3,
  },
  {
    name: "mixed currencies and time zones",
    rows: [
      { sold_at: "2026-01-01T12:00:00+01:00", amount: "€120.50", currency: "EUR", region: "EU" },
      { sold_at: "2026-01-01T09:30:00-05:00", amount: "$99.10", currency: "USD", region: "US" },
      { sold_at: "2026-01-02T08:00:00Z", amount: "£75.00", currency: "GBP", region: "UK" },
    ],
    expectRows: 3,
  },
];

async function run() {
  for (const testCase of cases) {
    const result = await analyzeCSV(testCase.rows);

    if (result.total_rows !== testCase.expectRows) {
      throw new Error(
        `${testCase.name}: expected ${testCase.expectRows} rows, got ${result.total_rows}`,
      );
    }

    if (!result.data_quality || !result.key_metrics) {
      throw new Error(`${testCase.name}: analyzer returned an incomplete result`);
    }

    console.log(`ok - ${testCase.name}`);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
