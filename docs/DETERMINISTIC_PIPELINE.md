# UseClevr Deterministic Pipeline Architecture

## Overview

UseClevr is a deterministic business analysis engine with an AI explanation layer. It adapts automatically to dataset context while remaining mathematically trustworthy. AI explains results – never invents them.

## Core Principles

1. **Preview vs Full Dataset Separation**: Preview rows (500-2000) are NEVER mixed with full dataset calculations
2. **Deterministic Computation**: All business metrics are computed from the complete dataset
3. **AI is Explainatory**: AI receives only precomputed metrics and explains them - never computes
4. **Auto-Adaptive**: System detects dataset type and tailors KPIs/charts/insights accordingly
5. **Single Source of Truth**: Precomputed metrics are stored and used by all layers (UI, charts, AI)

## Pipeline Flow

### 1. Upload & Storage
- Accepts CSV or Excel files
- Stores original file in durable storage (S3 / Cloudflare R2 / local)
- Creates DB record with metadata:
  - `dataset_id`, `filename`, `storage_key`, `file_size`, `mime_type`
  - `row_count`, `column_count`, `upload_timestamp`, `checksum`
- Returns `dataset_id` to frontend

### 2. Preview Generation (500-2000 rows)
Preview is used **ONLY** for:
- Schema detection
- Column inference
- UI preview display
- Mapping suggestions
- Dataset type detection

Preview is **NEVER** used for:
- KPI calculations
- Chart calculations
- Totals, averages, percentages
- Executive summaries
- Recommendations
- AI insight generation

### 3. Semantic Column Mapping + Auto Business Model Detection

**Dataset Type Detection** (new feature):
Detects dataset type with confidence score (0.0-1.0):
- `saas_metrics` (MRR, ARR, churn, subscription)
- `ecommerce_sales` (product, sku, order, quantity, price)
- `startup_finance` (funding, burn_rate, runway)
- `marketing_campaign` (impressions, clicks, conversions, CPC)
- `customer_churn`
- `financial_transactions`
- `inventory_management`
- `generic_business_data` (fallback if confidence < 0.4)

Detection uses:
- Column names (heuristic patterns)
- Column data types
- Preview row patterns

UI shows: "Detected: SaaS Metrics (92% confidence) – correct?"
Allows dropdown override that triggers re-analysis.

### 4. Data Cleaning & Normalization
Before full analysis:
- Remove currency symbols ($, €, £, etc.)
- Normalize decimal separators
- Standardize dates to ISO format
- Detect and handle missing/null/invalid values

If invalid rows > 10%:
Show warning banner: "Dataset contains X invalid rows – some insights may be incomplete"

### 5. Full Dataset Analysis (Trigger Rules)

**Small datasets (< 50k rows)**:
- Attempt automatic synchronous analysis
- Fall back to background if processing exceeds threshold

**Medium/large datasets (≥ 50k rows)**:
- User clicks "Analyze Full Dataset"
- Run as background job
- Show progress: "Analyzing 23% – ETA 45s"

**Computed Metrics** (from FULL dataset only):
- `total_revenue`, `total_cost`, `total_profit`, `margin`
- `growth_rate`, `growth_trend`
- `dataset-type-aware metrics`:
  - SaaS: MRR growth, churn rate, ARR, revenue per customer
  - E-commerce: revenue by product, units sold, regional sales
  - Startup: burn rate, runway, funding efficiency
- `top_product`, `top_region`
- `negative_profit_detection`
- `chart aggregations`

### 6. Precomputed Metrics – Single Source of Truth

Stored in:
- In-memory cache (Map)
- Redis (TTL 1h) - production
- Postgres JSONB column

Invalidated on:
- New upload
- Mapping change
- Dataset type override
- Manual re-analysis

All UI, charts, summaries, and AI read from this source only.

### 7. UI Rendering

- KPI cards, charts, executive summary use precomputed_metrics only
- Display detected type with override option
- Changing type triggers cache invalidation + re-analysis

### 8. AI Insight Layer

AI receives **ONLY**:
- `precomputed_metrics` (deterministic numbers)
- `dataset_type` (context for interpretation)

AI generates:
- Explanations
- Key takeaways
- Recommendations
- Risk highlights

AI **NEVER** computes numbers - all numbers come from precomputed_metrics.

### 9. Consistency Validation

After full analysis:
- Check totals match chart aggregates
- Check averages use full dataset row count
- Check KPIs match underlying data
- If inconsistency detected: log error, show warning banner

## File Structure

```
lib/
├── pipeline/
│   └── index.ts                    # Main exports
├── pipeline-types.ts               # Type definitions
├── preview-generator.ts            # Preview extraction (500-2000 rows)
├── column-mapper.ts                # Semantic column detection + override
├── dataset-type-detector.ts        # NEW: Auto business model detection
├── data-cleaner.ts                 # Data normalization
├── full-analysis-engine.ts         # Full dataset KPI computation
├── metrics-storage.ts              # Precomputed metrics storage
├── ai-insight-layer.ts             # AI explanation generation
├── pipeline-orchestrator.ts         # Pipeline coordination
├── background-jobs.ts               # Background job processing
└── upload-handler.ts               # NEW: S3/R2 file upload
```

## Usage Example

```typescript
import { 
  runAnalysisPipeline,
  detectDatasetType,
  getDatasetTypeDisplayName,
  getAllDatasetTypes,
  storeMetrics,
  getMetrics,
  applyDatasetTypeOverride,
} from './lib/pipeline';

// Run full pipeline
const result = await runAnalysisPipeline(
  datasetId,
  userId,
  allRows
);

// Access results
const { preview, columnMapping, metrics, aiInsights } = result;

// Check detected dataset type
console.log(`Detected: ${getDatasetTypeDisplayName(columnMapping.datasetType)} (${(columnMapping.datasetTypeConfidence * 100).toFixed(0)}% confidence)`);

// Override dataset type (triggers re-analysis)
const updatedMapping = applyDatasetTypeOverride(columnMapping, 'saas_metrics');

// Read from single source of truth
const cachedMetrics = getMetrics(datasetId);
```

## Environment Variables

```env
# Upload Provider (s3, r2, local)
UPLOAD_PROVIDER=r2

# S3 Configuration
AWS_S3_BUCKET=your-bucket
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx

# R2 Configuration  
R2_BUCKET=your-bucket
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_PUBLIC_URL=https://xxx.r2.dev

# Local Storage (fallback)
LOCAL_UPLOAD_DIR=/tmp/useclevr-uploads
LOCAL_UPLOAD_URL=/uploads
```

## Design Principles Summary

| Principle | Implementation |
|-----------|----------------|
| Preview ≠ Full | Preview (500-2000 rows) used only for schema/mapping |
| Deterministic | All KPIs computed from full dataset |
| AI Explanatory | AI receives metrics, not raw data |
| Auto-Adaptive | Dataset type detection with confidence scores |
| Single Source | Precomputed metrics stored and cached |
| Trustworthy | Consistency validation after analysis |
