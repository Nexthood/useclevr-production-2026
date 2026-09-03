import { answerDatasetQuestionDeterministically } from '../../src/lib/data/dataset-assistant-deterministic';

function dataset(input: {
  name: string
  rows: Record<string, unknown>[]
  columns: string[]
  businessModel?: string
}) {
  return {
    id: `synthetic_${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    userId: "synthetic_user",
    name: input.name,
    fileName: `${input.name}.xlsx`,
    fileSize: 1000,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    storageKey: null,
    checksum: null,
    rowCount: input.rows.length,
    columnCount: input.columns.length,
    columns: input.columns,
    data: input.rows,
    columnTypes: null,
    businessModel: input.businessModel ?? "standard",
    datasetType: "standard",
    analysis: null,
    precomputedMetrics: null,
  };
}

// We'll create 45 rows with the same value so that the sum is 126,384,909.53
// 126,384,909.53 / 45 = 2,808,553.545111...
const valuePerRow = 126384909.53 / 45;
const rowsData: Record<string, unknown>[] = [];
for (let i = 0; i < 45; i++) {
  rowsData.push({
    annual_revenue: valuePerRow,
    investment_date: `2020-01-${String(i + 1).padStart(2, '0')}`,
  });
}

const datasetObj = dataset({
  name: "05_investor_portfolio",
  rows: rowsData,
  columns: ["annual_revenue", "investment_date"],
  businessModel: "investor",
});

const columns = datasetObj.columns;
const rows = datasetObj.data;

// Test question 1: What is the total revenue?
const answer1 = answerDatasetQuestionDeterministically({
  question: "What is the total revenue?",
  datasetId: datasetObj.id,
  datasetType: "investor",
  columns,
  rows: rows,
});

console.log("Question 1 answer:", answer1.answer);
console.log("Question 1 insight:", answer1.insight);
console.log("Question 1 explanation:", answer1.explanation);

// Test question 2: What are the revenue trends over time?
const answer2 = answerDatasetQuestionDeterministically({
  question: "What are the revenue trends over time?",
  datasetId: datasetObj.id,
  datasetType: "investor",
  columns,
  rows: rows,
});

console.log("Question 2 answer:", answer2.answer);
console.log("Question 2 insight:", answer2.insight);
console.log("Question 2 explanation:", answer2.explanation);

// We expect answer1 to mention "combined annual revenue of the portfolio companies"
// We expect answer2 to say that it cannot be calculated or something similar.
