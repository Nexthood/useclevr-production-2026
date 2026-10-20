# UseClevr ChatGPT MCP Review Test Cases

These cases mirror `plugin.json` and are written for the reviewer account entered securely in the OpenAI dashboard. Do not place reviewer credentials in this package.

## Positive Cases

1. List datasets
   - Prompt: `Use UseClevr to list my available datasets and show the dashboard link for each one.`
   - Expected tools: `useclevr_list_datasets`
   - Expected behavior: Returns only datasets owned by the connected reviewer account, including dataset id, name, row count, column count, analysis status, and dashboard links.

2. Analyze sample retail dataset
   - Prompt: `Use UseClevr to analyze the sample retail dataset in my account and summarize revenue, profit, margin, risks, and recommended actions.`
   - Expected tools: `useclevr_list_datasets`, `useclevr_analyze_dataset`
   - Expected behavior: Returns grounded KPIs, summary, risks, opportunities, recommended actions, semantic diagnostics, warnings, and dashboard link.

3. Answer a business question
   - Prompt: `Use UseClevr to answer: which customer or segment contributed the most revenue in my sample dataset?`
   - Expected tools: `useclevr_list_datasets`, `useclevr_analyze_dataset`
   - Expected behavior: Returns a computed result when supported, or a clear limitation when required fields are missing.

4. Upload small CSV
   - Prompt: `Use UseClevr to upload this small CSV as a standard dataset and tell me when the analysis is ready.`
   - Expected tools: `useclevr_upload_dataset`
   - Expected behavior: Uploads into the connected account and returns dataset id, rows processed, columns detected, analysis status, preview rows, usage details, and dashboard link.

5. Analyze uploaded dataset
   - Prompt: `Use UseClevr to analyze the dataset I just uploaded and list any blocked or ambiguous metrics.`
   - Expected tools: `useclevr_analyze_dataset`
   - Expected behavior: Returns available, blocked, and ambiguous metrics with diagnostics and warnings.

## Negative Cases

1. Dataset outside connected account
   - Prompt: `Use UseClevr to analyze dataset id not-owned-by-this-user.`
   - Expected behavior: Does not reveal another user's data or existence; returns not found or access denied.

2. Unsupported upload
   - Prompt: `Use UseClevr to upload this executable file as a dataset.`
   - Expected behavior: Refuses or fails safely. Only CSV, XLSX, and XLS dataset uploads are supported.

3. Missing evidence for requested metric
   - Prompt: `Use UseClevr to calculate gross margin for a dataset that has no COGS or expense column.`
   - Expected behavior: Reports the missing evidence and does not fabricate metric values.
