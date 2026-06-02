Build a complete “Business Profile Setup” for UseClevr, designed for SMEs, startups, freelancers, consultants, small agencies, e-commerce businesses, local service companies, logistics companies, restaurants, construction companies, real estate businesses, and small manufacturers.

The goal is to collect all relevant company data needed for accurate business intelligence, financial analysis, KPI generation, profitability analysis, cash-flow forecasting, tax estimation, insurance overview, loan/leasing impact, and decision support.

Do not build a generic onboarding form. Build a structured business profile that works like a lightweight pre-accounting and business intelligence foundation.

The system must collect enough data so that UseClevr can later generate accurate dashboards, KPIs, forecasts, warnings, recommendations, and business reports.

Core Requirements:

1. Company Identity
   Collect:

- Legal company name
- Trading name / brand name
- Country
- City
- Legal form
- Registration number
- VAT number
- Tax identification number
- Industry / sector
- Business model type
- Company size
- Year founded
- Main operating currency
- Secondary currencies if used
- Main language
- Accounting method if known
- Fiscal year start and end
- Responsible contact person
- Role of the user inside the company

2. Business Type Classification
   The system must ask what kind of business the company is:

- Startup
- SME
- Freelancer / self-employed
- Agency
- Consultant
- E-commerce
- Retail
- Restaurant / hospitality
- Manufacturing
- Construction
- Logistics
- Real estate
- SaaS / software
- Professional services
- Import / export
- Other

The selected business type must influence which additional questions are shown. For example:

- E-commerce needs product margin, inventory, returns, ad spend, shipping costs.
- SaaS needs MRR, ARR, churn, CAC, LTV, subscriptions, trials.
- Construction needs project costs, subcontractors, materials, equipment, insurance, guarantees.
- Restaurants need food cost, staff cost, rent, waste, daily revenue, supplier costs.
- Logistics needs vehicle costs, fuel, maintenance, insurance, route costs.
- Real estate needs rent income, mortgage, maintenance, vacancy rate, property tax.
- Agencies need billable hours, retainers, project revenue, staff utilization.
- Manufacturing needs raw material costs, production capacity, machine costs, waste, inventory.

3. Revenue Setup
   Collect all revenue streams:

- Product sales
- Service revenue
- Subscription revenue
- Project-based revenue
- Consulting revenue
- Commission income
- Licensing income
- Rental income
- Marketplace income
- Affiliate income
- Grants / subsidies
- Other income

For each revenue stream collect:

- Name
- Description
- Monthly average revenue
- Annual average revenue
- Currency
- VAT treatment
- Payment terms
- Average payment delay
- Gross margin estimate
- Refunds / returns rate if applicable
- Seasonality
- Main customer segment
- B2B / B2C / B2G

4. Customer and Sales Data
   Collect:

- Number of active customers
- Number of new customers per month
- Average order value
- Average contract value
- Average customer lifetime
- Sales cycle length
- Conversion rate
- Lead sources
- Main sales channels
- Online sales percentage
- Offline sales percentage
- Recurring revenue percentage
- Customer concentration risk
- Top 5 customers by revenue if available

For SaaS companies also collect:

- MRR
- ARR
- ARPU
- Number of paying users
- Number of free users
- Trial conversion rate
- Monthly churn rate
- Annual churn rate
- Expansion revenue
- Downgrade revenue
- CAC
- LTV
- Payback period
- Gross revenue retention
- Net revenue retention

5. Cost Structure
   Collect all monthly and yearly costs in structured categories.

Fixed costs:

- Office rent
- Utilities
- Internet / phone
- Software subscriptions
- Accounting services
- Legal services
- Bank fees
- Hosting / cloud costs
- Salaries
- Employer taxes
- Insurance
- Leasing
- Loan repayments
- Vehicle costs
- Rent / property costs
- Maintenance
- Licenses
- Memberships
- Marketing retainers
- Other fixed costs

Variable costs:

- Cost of goods sold
- Raw materials
- Packaging
- Shipping
- Payment processing fees
- Sales commissions
- Freelancer costs
- Subcontractors
- Ad spend
- Fuel
- Marketplace fees
- Refunds
- Warranty costs
- Production waste
- Other variable costs

The system must separate:

- Net cost
- VAT amount
- Gross cost
- Payment frequency
- Payment due date
- Supplier name
- Cost category
- Deductibility if known
- Whether it is operational expense, capital expense, financing cost, or tax-related cost

6. Taxes
   Collect all tax-relevant information carefully, without pretending to replace a certified accountant.

Ask for:

- Country of tax residence
- VAT registered: yes/no
- VAT rate or multiple VAT rates
- VAT filing frequency
- Corporate income tax rate if known
- Micro-company tax / small business tax regime if applicable
- Payroll tax obligations
- Social contribution obligations
- Dividend tax if relevant
- Withholding tax if relevant
- Local business taxes
- Property tax
- Vehicle tax
- Import duties
- Reverse charge VAT usage
- EU cross-border VAT sales
- OSS/IOSS usage for e-commerce if applicable
- Tax prepayments
- Tax arrears
- Expected annual tax liability
- Accountant name/contact if available

The system must support country-specific configuration later, but the data model must be generic enough for EU businesses.

The output must clearly separate:

- Tax estimates
- Confirmed tax values entered by the user
- Values that require accountant verification

Never present tax estimates as legal advice.

7. Insurance
   Collect all business insurance policies:

- General liability insurance
- Professional liability insurance
- Product liability insurance
- Cyber insurance
- Property insurance
- Vehicle insurance
- Employer liability insurance
- Health-related employee insurance if applicable
- Equipment insurance
- Construction/project insurance
- Business interruption insurance
- Legal protection insurance
- Cargo/shipping insurance
- Other insurance

For each insurance policy collect:

- Provider
- Policy number
- Coverage type
- Coverage amount
- Monthly or annual premium
- Deductible
- Renewal date
- Expiry date
- Covered risks
- Exclusions if known
- Related business asset or activity
- Payment frequency

The system must later be able to calculate:

- Total insurance cost per month/year
- Missing insurance warnings based on business type
- Renewal reminders
- Risk exposure overview

8. Loans, Leasing, Debt and Financing
   Collect:

- Bank loans
- Private loans
- Credit lines
- Overdrafts
- Equipment leasing
- Vehicle leasing
- Real estate mortgage
- Invoice financing
- Factoring
- Investor loans
- Convertible notes
- Grants
- Subsidies
- Founder loans
- Family/friend loans

For each financing item collect:

- Lender/provider
- Original amount
- Current outstanding balance
- Interest rate
- Monthly payment
- Start date
- End date
- Remaining months
- Collateral
- Fixed or variable rate
- Purpose of financing
- Fees
- Early repayment conditions
- Payment due date

The system must calculate:

- Total monthly debt service
- Debt-to-revenue ratio
- Interest burden
- Liquidity pressure
- Remaining liability
- Financing risk

9. Assets and Equipment
   Collect:

- Cash balance
- Bank accounts
- Inventory value
- Vehicles
- Machines
- IT equipment
- Real estate
- Tools
- Furniture
- Intellectual property
- Software assets
- Financial investments
- Receivables
- Other assets

For each asset collect:

- Asset name
- Category
- Purchase value
- Current estimated value
- Purchase date
- Depreciation period if known
- Financing method
- Insurance coverage
- Maintenance cost
- Location
- Responsible person

10. Employees, Payroll and HR Costs
    Collect:

- Number of employees
- Number of founders
- Number of freelancers
- Number of contractors
- Monthly gross salaries
- Employer taxes
- Social contributions
- Bonuses
- Benefits
- Payroll provider
- Average working hours
- Billable hours if relevant
- Department/team structure
- Hiring plans
- Expected salary increases
- Employee turnover

The system must calculate:

- Total payroll cost
- Payroll as percentage of revenue
- Revenue per employee
- Profit per employee
- Staff cost pressure
- Hiring affordability

11. Cash Flow and Payment Terms
    Collect:

- Current bank balance
- Average monthly inflow
- Average monthly outflow
- Accounts receivable
- Accounts payable
- Average collection time
- Average supplier payment time
- Payment terms to customers
- Payment terms from suppliers
- Late payments
- Tax payment dates
- Loan payment dates
- Payroll dates
- Rent payment date
- Insurance payment dates
- Expected large payments
- Expected large incoming payments

The system must calculate:

- Monthly cash flow
- Cash runway
- Liquidity risk
- Upcoming payment pressure
- Break-even point
- Minimum required cash reserve

12. Inventory and Stock, if relevant
    For product, retail, e-commerce, manufacturing and restaurant businesses collect:

- Inventory value
- Number of SKUs
- Average stock turnover
- Slow-moving stock
- Raw material stock
- Finished goods stock
- Supplier lead time
- Storage cost
- Waste/spoilage rate
- Return rate
- Reorder threshold
- Average purchase price
- Average selling price

The system must calculate:

- Gross margin
- Stock turnover
- Dead stock risk
- Working capital tied in inventory
- Reorder warnings

13. Marketing and Sales Spend
    Collect:

- Monthly ad spend
- Channels used
- CAC
- Cost per lead
- Cost per acquisition
- Website traffic
- Conversion rate
- Email list size
- Social media spend
- Agency fees
- Sales team cost
- Commission structure
- Campaign ROI
- Top performing channels

The system must calculate:

- Marketing ROI
- CAC payback
- Revenue per channel
- Lead-to-customer conversion
- Campaign efficiency

14. Compliance and Legal
    Collect:

- Required licenses
- Permits
- Industry certifications
- Data protection obligations
- GDPR relevance
- Contracts with customers
- Supplier contracts
- Employment contracts
- Lease contracts
- Loan contracts
- IP ownership
- Pending legal disputes
- Warranty obligations
- Regulatory risks
- Audit obligations

The system must generate warnings if important compliance information is missing, but must not provide legal advice.

15. Risk Profile
    Collect:

- Main business risks
- Dependency on one customer
- Dependency on one supplier
- Currency risk
- Interest rate risk
- Seasonality risk
- Legal risk
- Tax risk
- Cybersecurity risk
- Inventory risk
- Cash flow risk
- Employee dependency risk
- Market risk
- Operational risk

The system must generate:

- Risk score
- Risk summary
- Priority warnings
- Recommended next actions

16. Goals and Forecasting Inputs
    Collect:

- Revenue target
- Profit target
- Growth target
- Hiring target
- Cost reduction target
- Investment target
- Funding target
- Expansion plans
- New product plans
- Market expansion plans
- Expected revenue growth
- Expected cost growth
- Expected tax changes
- Expected large investments

The system must support:

- Conservative forecast
- Realistic forecast
- Optimistic forecast
- Worst-case scenario

17. Required Outputs After Setup
    After the Business Profile is completed, UseClevr must generate:

A. Business Profile Summary

- Company overview
- Business model
- Revenue streams
- Cost structure
- Tax setup
- Insurance overview
- Financing overview
- Assets overview
- Employee overview
- Risk profile

B. KPI Dashboard

- Monthly revenue
- Annual revenue
- Gross profit
- Net profit
- Gross margin
- Net margin
- EBITDA estimate
- Cash runway
- Break-even point
- Debt service coverage
- Payroll ratio
- Marketing ROI
- CAC
- LTV if relevant
- Revenue per employee
- Fixed cost ratio
- Variable cost ratio
- Tax reserve estimate
- Insurance cost ratio

C. Financial Health Score
Calculate a clear financial health score based on:

- Profitability
- Liquidity
- Debt burden
- Revenue stability
- Customer concentration
- Cost structure
- Tax obligations
- Insurance coverage
- Cash-flow risk
- Growth capacity

D. Missing Data Report
The system must clearly show:

- Missing critical information
- Missing optional information
- Data that needs accountant verification
- Data that needs legal verification
- Data that affects forecast accuracy

E. Recommendations
Generate practical recommendations such as:

- Reduce specific cost categories
- Improve payment terms
- Increase tax reserve
- Review insurance coverage
- Refinance expensive debt
- Improve gross margin
- Reduce customer dependency
- Improve cash runway
- Prepare for funding
- Improve reporting quality

18. UX Requirements
    The Business Profile setup must be simple but complete.

Use a step-by-step wizard:

1. Company Basics
2. Business Type
3. Revenue
4. Costs
5. Taxes
6. Insurance
7. Loans and Leasing
8. Employees
9. Assets
10. Cash Flow
11. Risks
12. Goals
13. Review and Generate Profile

Use conditional logic:
Only show relevant sections based on business type.

Use save-and-continue:
The user must be able to complete the setup gradually.

Use clear labels:
Every field must have a short explanation and example.

Use required/optional field logic:
Critical fields must be required, advanced fields optional.

Use validation:

- Currency fields must be numeric
- Dates must be valid
- Percentages must be between 0 and 100
- VAT/tax fields must not be mixed with net/gross values incorrectly
- Monthly and yearly values must be normalized correctly
- Duplicate costs must be detected
- Missing payment dates must trigger warnings

19. Data Model Requirements
    Create a clean data model with separate entities:

- CompanyProfile
- BusinessType
- RevenueStream
- CostItem
- TaxProfile
- InsurancePolicy
- LoanOrLeasingItem
- Asset
- EmployeeCost
- CashFlowProfile
- InventoryProfile
- MarketingProfile
- ComplianceProfile
- RiskProfile
- GoalProfile
- ForecastScenario
- MissingDataItem
- Recommendation

Each entity must be structured so it can later be stored in Supabase/PostgreSQL.

Avoid overengineering. Keep the model practical, scalable, and understandable.

20. Calculation Rules
    The calculations must always match the collected data.

The system must:

- Distinguish net, VAT, and gross values
- Normalize monthly, quarterly, and yearly payments
- Avoid double-counting tax, insurance, loans, payroll, and depreciation
- Separate operating costs from financing costs
- Separate revenue from grants/subsidies
- Separate fixed and variable costs
- Calculate gross margin only from relevant cost of goods/services
- Calculate net profit after operating costs, financing costs, estimated taxes, and other obligations
- Flag low-confidence results when important data is missing
- Show assumptions used in every calculation
- Allow the user to override assumptions

21. Important Safety and Accuracy Rules
    UseClevr must not claim to replace an accountant, tax advisor, lawyer, or insurance broker.

All tax, legal, and insurance outputs must be marked as:

- Estimate
- User-provided value
- Requires professional verification

The system must be accurate, transparent, and practical.

The goal is not to create a complicated enterprise ERP. The goal is to create a clean, complete, user-friendly business profile that gives SMEs and startups reliable business intelligence and decision support from their own data.

Final deliverables:

- Full Business Profile field structure
- Conditional questions by business type
- Supabase-ready data model
- KPI calculation logic
- Missing data logic
- Risk scoring logic
- UI wizard structure
- Example output report
- Implementation plan with minimal practical steps

--

Build a focused “Business Profile Setup” for UseClevr.

The first target users are:

- Startups
- SaaS companies
- Small B2B businesses
- Freelancers
- Consultants
- Digital agencies
- Service-based companies
- Online businesses

Do not include complex industries such as manufacturing, restaurants, food businesses, logistics, construction, real estate, or inventory-heavy companies in this first version.

The goal is to collect only the essential business information needed to generate accurate KPIs, financial insights, simple forecasts, risks, and recommendations.

Create a clean step-by-step setup wizard with these sections:

1. Company Basics
   Collect:

- Company name
- Country
- City
- Legal form
- Industry
- Business type
- Main currency
- Year founded
- Team size
- VAT registered: yes/no
- Fiscal year
- User role

2. Business Model
   Ask what the company mainly sells:

- SaaS subscription
- Digital service
- Consulting
- Freelance work
- Agency projects
- Online product/service
- Commission-based income
- Other

Collect:

- Main offer
- Target customers
- B2B or B2C
- Main sales channels
- Average customer type
- Recurring or one-time revenue

3. Revenue
   Collect:

- Monthly revenue
- Annual revenue
- Number of customers
- Average order/contract value
- Recurring revenue percentage
- Payment terms
- Average payment delay
- Main revenue streams

For SaaS also collect:

- MRR
- ARR
- Number of paying users
- Trial users
- Churn rate
- ARPU
- CAC if known
- LTV if known

4. Costs
   Collect only relevant cost categories:

- Software subscriptions
- Hosting/cloud costs
- Marketing/ad spend
- Freelancer/contractor costs
- Salaries/founder salary
- Accounting costs
- Legal costs
- Office/coworking costs
- Internet/phone
- Payment processing fees
- Sales commissions
- Loan repayments if any
- Other monthly costs

For each cost collect:

- Name
- Category
- Monthly amount
- Yearly amount if relevant
- Net/gross amount if known
- VAT included: yes/no
- Payment frequency

5. Taxes
   Collect simple tax-related data:

- VAT registered: yes/no
- VAT rate if known
- Corporate tax rate if known
- Income tax / freelancer tax if relevant
- Payroll/social contributions if relevant
- Tax payment frequency
- Accountant available: yes/no

Important:
UseClevr must mark tax values as estimates unless they are entered by the user.
Do not provide legal or tax advice.

6. Insurance
   Collect only business-relevant insurance:

- Professional liability insurance
- General liability insurance
- Cyber insurance
- Legal protection insurance
- Equipment insurance
- Other insurance

For each insurance collect:

- Provider
- Monthly or yearly cost
- Renewal date
- Coverage amount if known

7. Loans and Financing
   Collect:

- Business loans
- Credit lines
- Founder loans
- Investor loans
- Grants/subsidies

For each item collect:

- Amount
- Monthly payment
- Interest rate if known
- Remaining balance
- End date

8. Cash Flow
   Collect:

- Current bank balance
- Monthly incoming payments
- Monthly outgoing payments
- Open invoices
- Unpaid bills
- Average payment delay
- Upcoming large payments
- Upcoming large incoming payments

Calculate:

- Cash runway
- Monthly cash flow
- Liquidity risk
- Break-even point

9. Goals
   Collect:

- Monthly revenue target
- Profit target
- Growth target
- Cost reduction target
- Funding target
- Hiring plan
- Main business challenge

10. Outputs
    After setup, UseClevr should generate:

- Business profile summary
- Revenue overview
- Cost overview
- Profit estimate
- Cash-flow overview
- Tax reserve estimate
- Insurance overview
- Debt/financing overview
- Financial health score
- Missing data report
- Practical recommendations

11. KPI Logic
    Calculate:

- Monthly revenue
- Annual revenue
- Gross profit estimate
- Net profit estimate
- Gross margin
- Net margin
- Fixed costs
- Variable costs
- Cash runway
- Break-even point
- Revenue per customer
- Revenue per employee
- Marketing spend ratio
- Payroll ratio
- Debt payment ratio
- Tax reserve estimate

For SaaS additionally calculate:

- MRR
- ARR
- Churn
- ARPU
- CAC
- LTV
- CAC payback if possible

12. Accuracy Rules
    The system must:

- Separate revenue, costs, taxes, insurance, and loan payments clearly
- Avoid double-counting costs
- Separate net, VAT, and gross values when available
- Show assumptions used in calculations
- Mark uncertain results as low-confidence
- Show missing critical data
- Allow users to edit assumptions
- Never claim to replace an accountant, tax advisor, lawyer, or insurance broker

Keep the setup simple, practical, and fast.
Do not overengineer it.
The goal is to create a focused Business Profile for digital businesses, startups, SaaS, agencies, freelancers, and consultants.
