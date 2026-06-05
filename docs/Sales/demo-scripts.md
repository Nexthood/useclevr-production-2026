# UseClevr Demo Scripts

## Demo Dataset Reference

Two demo datasets are provided in `docs/Sales/demo-datasets/`:

| File                         | Content                                                                     | Best For                     |
| ---------------------------- | --------------------------------------------------------------------------- | ---------------------------- |
| `saas-revenue-2025-h1.csv`   | 32 rows: Date, Product, Region, Revenue, Cost, Quantity, CustomerType       | Founder, SME owner demos     |
| `beverage-sales-q1-2025.csv` | 36 rows: Date, Product, Category, UnitsSold, UnitPrice, CostPerUnit, Region | Consultant, e-commerce demos |

---

## Demo 1: Founder Demo (5 minutes)

**Dataset**: `saas-revenue-2025-h1.csv`
**Persona**: Startup founder who needs to understand business performance.

### Walkthrough

1. **Upload** (30s)
   - Navigate to Upload page.
   - Upload `saas-revenue-2025-h1.csv`.
   - Show auto-detected columns and preview.

2. **Ask AI questions** (2 min)
   - "What is our total revenue?"
   - "Which product generates the most revenue?"
   - "Which region performs best?"
   - "Show me revenue trend over time."

3. **Review insights** (1 min)
   - Point to AI answer showing computed KPIs.
   - Note that answers include actual numbers from the dataset (not generic AI).

4. **Business Profile** (1 min)
   - Open Business → Setup.
   - Enter company name, select legal structure, add industry.
   - Show how accuracy percentage improves as fields are filled.

5. **Download report** (30s)
   - Open Reports & Downloads.
   - Download the generated report.

---

## Demo 2: SME Owner Demo (7 minutes)

**Dataset**: `beverage-sales-q1-2025.csv`
**Persona**: Small business owner who wants sales and margin analysis.

### Walkthrough

1. **Upload** (30s)
   - Navigate to Upload.
   - Upload `beverage-sales-q1-2025.csv`.

2. **AI questions** (2 min)
   - "What is our total revenue and profit by product?"
   - "Which products have the best margins?"
   - "What is our best selling product by quantity?"

3. **Business Profile** (2 min)
   - Open Business → Setup.
   - Fill company info, tax settings, revenue rules.
   - Show how setup accuracy score increases.
   - Point to accountant review flags.

4. **Accountancy overview** (1 min)
   - Navigate to Accountancy.
   - Show bookkeeping readiness indicators.

5. **Download** (30s)
   - Generate and download a report.

6. **Tickets** (30s)
   - Show how to open a support ticket from any page.

---

## Demo 3: Consultant Demo (5 minutes)

**Dataset**: Both datasets
**Persona**: Consultant preparing client reports.

### Walkthrough

1. **Upload client data** (1 min)
   - Upload a demo dataset representing client data.
   - Show data preview with detected columns.

2. **Ask analysis questions** (2 min)
   - "Compare revenue across regions."
   - "Show me top products by profit margin."
   - "What is the growth trend?"

3. **Export** (1 min)
   - Download results as CSV for client workbook.
   - Download report as PDF for client presentation.

4. **Re-run with different AI provider** (1 min)
   - Open AI history.
   - Re-run the same question with a different provider.
   - Show how answers differ in explanation style but agree on numbers.

---

## Demo 4: Accountancy-Prep Demo (3 minutes)

**Dataset**: `saas-revenue-2025-h1.csv`
**Persona**: Business owner preparing for accountant review.

### Walkthrough

1. **Upload** (30s) — Upload the SaaS dataset.
2. **Business Setup** (1.5 min)
   - Fill company details, tax settings, expense categories.
   - Show accountant review flags (missing fields, uncertain items).
3. **Accountancy page** (1 min)
   - Show the Accountancy overview.
   - Explain that organized data + business context = faster accountant review.

---

## Demo 5: Founder — Full Product Tour (10 minutes)

**Dataset**: `saas-revenue-2025-h1.csv`

### Walkthrough

1. **Homepage and signup** (1 min)
   - Show homepage value prop, pricing, FAQ.

2. **Upload dataset** (1 min)
   - Upload the SaaS dataset.
   - Show schema detection.

3. **AI Assistant** (3 min)
   - Ask 4-5 business questions.
   - Show that answers include real computed values.
   - Show AI history and ability to re-run questions.

4. **Business Profile** (2 min)
   - Complete the Company Setup Wizard.
   - Show accuracy score and review flags.

5. **Accountancy readiness** (1 min)
   - Overview of bookkeeping and compliance status.

6. **Reports** (1 min)
   - Download a report.

7. **Support** (30s)
   - Show FAQ, help chat, and ticket creation.

8. **Pricing and upgrade** (30s)
   - Show plan comparison and checkout flow.

---

## Objection Handling

| Objection                            | Response                                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| "I already use Excel/Sheets"         | UseClevr adds AI analysis and report-ready output on top of your existing data.                                   |
| "ChatGPT can answer my questions"    | ChatGPT gives generic answers. UseClevr ties answers to your actual uploaded data with verified computed numbers. |
| "I need an accountant, not software" | UseClevr helps you organize data before an accountant reviews it — saves time and cost.                           |
| "My data is sensitive"               | Data is stored in encrypted PostgreSQL (EU, GDPR). AI sees only aggregated metrics, never raw rows.               |
| "I am not technical"                 | No SQL or BI skills needed. Upload a CSV and ask questions in plain English.                                      |
