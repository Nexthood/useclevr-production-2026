# Requirements — UseClevr

> This file captures product-facing requirements. Each entry describes what a user
> experiences or needs, not how the system is implemented. Updated after each
> completed task cycle.

## User-Facing Requirements

### Upload & Analysis

- Users can upload CSV or Excel files and receive instant AI-generated analysis.
- Uploaded datasets render in a structured data table with row-count metadata.
- Users can ask AI questions about their uploaded dataset and get structured answers.
- AI analysis uses a two-pass discovery + query pipeline so questions stay within data scope.
- Hybrid AI Lite lets Pro-tier users pose crowd-level questions against their own data.
- Hybrid AI MEGA lets Business-tier users run large-scale federated queries at scale.

### Downloads & Reports

- Pro and Business tier users can generate and download PDF reports from analysis results.
- Downloads are tracked per dataset and entry, supporting click-action logging.
- PDF export packages charting output and tabular detail into a shared downloadable file.

### Subscriptions & Billing

- Users can view available plans (Free, Pro Monthly, Pro Annual, Business Monthly) and upgrade directly.
- A two-step checkout flow requires plan review before terms acceptance before any payment is taken.
- Annual Pro subscriptions receive an automatic discount at checkout.
- Subscriptions stay in sync with the payment provider so plan access and billing status update
  immediately after any payment-event change.
- Users can manage their subscription, view usage, and downgrade or cancel without leaving the app.
- Free tier users receive a limited analyst-credit allowance and are prompted to subscribe when it
  is exhausted.

### Business Profile

- Users fill in company name, industry, location, website, and description in Settings.
- A live completion percentage is shown in the topbar so users can see how complete their
  business profile is.
- Incomplete business profile fields are surfaced in the topbar with a direct link to Settings.

### Support

- Dashboard users can submit support tickets and track their resolution status from the Tickets page.
- Super-admins have a ticket queue for reviewing customer issues, adding support notes,
  and marking tickets resolved.
- A built-in FAQ answers account, billing, dataset, report, credits, and Hybrid AI questions.
- A protected operator FAQ covers support operations, payments, billing recovery, security,
  and incident handling for authorised platform staff only.

### Payment Provider Setup

- Platform operators can confirm whether the payment provider is connected before customers
  reach checkout.
- Payment provider configuration is gated to super-admin role only.
- The payment setup page shows the current status of secret key and webhook secret.

### Reference Files

- Terms & Conditions are at `https://useclevr.com/terms`
- Privacy Policy is at `https://useclevr.com/privacy`
- Public plans page at `/pricing`
