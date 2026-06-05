You are working on the UseClevr SaaS project.

Main instruction:
Do not implement Supermemory or any external memory/RAG provider now. Ignore Supermemory completely for current implementation.

UseClevr must build its own stable learning/context system based on:

- uploaded datasets,
- saved Business Profile data,
- deterministic calculation results,
- previous user analysis summaries stored in the app database,
- explicit user/project settings,
- safe internal MCP/API context if needed later.

The goal is not to create a generic chatbot. The goal is to make UseClevr’s AI reliably understand the user’s company data and answer based on real uploaded business information.

Current priorities:

1. Stability first
2. Dataset-aware answers
3. Business Profile context
4. Deterministic calculation consistency
5. Clear confidence labels
6. Safe internal context handling
7. Minimal implementation, no overengineering

Implementation rules:

1. Dataset context must come first
   When a user uploads a CSV or dataset, the AI must use the dataset context before giving any generic answer.

The AI response pipeline should follow this order:

- detect active dataset
- read dataset metadata
- read detected columns
- read sample rows or summarized rows
- read deterministic KPI/calculation outputs
- read Business Profile context
- then generate the answer

If dataset context exists, the AI must not answer generically.

2. Add dataset context builder
   Create or improve a helper like:

```ts
buildDatasetContextForAI(datasetId, userId);
```

It should return:

- dataset name
- upload date
- row count
- column names
- detected column types
- detected business meaning of columns
- sample rows where safe
- summary statistics
- KPI outputs
- chart suggestions
- known parsing warnings
- confidence level

Keep it compact. Do not pass the entire dataset into the AI unless explicitly needed and safe.

3. Add Business Profile context builder
   Create or improve a helper like:

```ts
buildBusinessContextForAI(userId, businessId);
```

It should return:

- business name
- country
- currency
- business type
- industry
- VAT/tax basics
- revenue streams
- fixed costs
- variable costs
- insurance summary
- loans/leasing summary
- payroll summary
- cash-flow dates
- risk profile
- missing important fields
- accountant/tax verification flags

The Business Profile must support the AI and deterministic calculations, but it must not become a full ERP.

4. Add company calculation context
   Create or improve:

```ts
buildCompanyCalculationContext({
  datasetContext,
  businessProfile,
});
```

This context must feed deterministic calculations for:

- revenue
- gross profit
- net profit estimate
- fixed cost ratio
- variable cost ratio
- cash-flow pressure
- tax reserve estimate
- debt pressure
- payroll pressure
- insurance cost overview
- runway if relevant
- financial health score

The AI should explain results, but calculations must come from deterministic logic wherever possible.

5. AI must cite its internal basis clearly
   The AI answer should clearly say what it used:

- uploaded dataset
- Business Profile
- calculated KPIs
- user-provided assumptions
- missing fields

Example:
“Based on your uploaded CSV and Business Profile, revenue appears stable, but cash-flow confidence is medium because tax payment dates and supplier payment terms are missing.”

6. Add confidence labels
   Every AI business answer should include a confidence level:

- High confidence: dataset and Business Profile are complete enough
- Medium confidence: important data exists, but some fields are missing
- Low confidence: dataset is weak, missing, ambiguous, or not connected to Business Profile

Do not hide uncertainty.

7. Missing data behavior
   If important data is missing, the AI should not invent it.

Instead, it should return:

- what is missing
- why it matters
- how it affects the result
- what the user should add next

Example:
“VAT cannot be estimated accurately because VAT registration status and VAT rate are missing.”

8. Learning behavior
   UseClevr should “learn” only from explicit, stored, user-owned data.

Allowed learning sources:

- uploaded datasets
- saved Business Profile fields
- saved analysis summaries
- user-selected preferences
- user corrections
- project settings

Not allowed:

- hidden assumptions
- external memory providers
- unsafely storing raw prompts without reason
- using one customer’s data for another customer
- using private uploaded files outside the user’s own account/context

9. Store useful summaries, not everything
   After each analysis, store a compact internal summary such as:

```ts
AnalysisMemorySummary {
  id
  userId
  businessId
  datasetId
  createdAt
  question
  keyFindings
  calculatedKpis
  missingData
  confidenceLevel
  userCorrections
}
```

This gives UseClevr continuity without adding external memory infrastructure.

10. User corrections improve future answers
    If the user corrects the AI, store the correction as user-owned context.

Example:
User says:
“No, this column means gross revenue, not net revenue.”

Then save:

- datasetId
- column name
- corrected meaning
- timestamp
- userId

Future analysis of that dataset should use the correction.

11. MCP rule
    Keep MCP internal for now.

Do not create `mcp.useclevr.com` yet.

If MCP endpoints exist, keep them under:

- `/api/mcp/*`

MCP must require:

- authenticated session or signed service token
- role check
- business/workspace ownership check
- dataset access check
- tool allowlist
- rate limiting
- audit logging

Do not expose public tool discovery. Unauthenticated requests must not reveal tool names, schemas, dataset names, file paths, or business IDs.

12. Stability rules
    Before changing AI logic, check:

- current routes
- existing dataset parsing code
- existing analysis flow
- current Business Profile fields
- current DB schema
- current Railway deployment flow

Do not break:

- Railway `dist` production deploy
- Railway `dist-test` staging deploy
- existing CSV upload
- existing dashboard pages
- existing auth/session behavior
- existing billing routes

13. Minimal implementation path
    Implement in small steps:

Step 1:
Audit current AI answer flow and identify where generic answers happen.

Step 2:
Add dataset context builder.

Step 3:
Add Business Profile context builder.

Step 4:
Connect both into the AI prompt/server route.

Step 5:
Add confidence labels and missing-data warnings.

Step 6:
Store compact analysis summaries.

Step 7:
Add user correction handling only after the above works.

Do not implement a large memory system first.

14. Output requirements
    After implementation, provide:

- changed files
- what was improved
- exact commands to test
- one example dataset-aware answer
- one example missing-data answer
- known limitations
- no vague claims

Important:
UseClevr must become reliable because it understands the user’s actual business data. Stability and correctness are more important than adding new AI tools.
