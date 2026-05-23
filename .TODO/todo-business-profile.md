# Business Profile Settings Implementation Plan

## Table of Contents
- [S1: Overview](#s1-overview)
- [S2: Data Model Changes](#s2-data-model-changes)
- [S3: Business Profile Listing Page](#s3-business-profile-listing-page)
- [S4: Individual Business Profile Page](#s4-individual-business-profile-page)
- [S5: Business Operations](#s5-business-operations)
- [S6: Tax & Accountancy Details](#s6-tax--accountancy-details)
- [S7: Review & Validation Screen](#s7-review--validation-screen)
- [S8: User Flows & Navigation](#s8-user-flows--navigation)

---

## S1: Overview
Multi-business support for user accounts in the dashboard. Each user can manage up to 3 businesses (limit configurable by super-admin). Each business has its own profile, operations, and tax details.

---

## S2: Data Model Changes
Database schema updates required for multi-business support.

### T2.1 Business Table
- [ ] Create `Business` table with fields: id, userId, name, companyNumber, address, email, phone, website, description
- [ ] Add createdAt, updatedAt timestamps
- [ ] Foreign key to User table

### T2.2 BusinessOperation Table
- [ ] Create `BusinessOperation` table with fields: id, businessId, country, address, currency, taxDetails (JSON)
- [ ] One-to-many relationship to Business

### T2.3 Tax Details Cache
- [ ] Add tax details caching mechanism (7-day cache for auto-loaded tax data)
- [ ] Fields: taxRates, filingDates, localRequirements (JSON)

### T2.4 Soft Delete for Business Archive
- [ ] Add `archivedAt` timestamp field
- [ ] Add `status` enum (active, archived, deleted)
- [ ] Add `deletedAt` timestamp for permanent deletion tracking

---

## S3: Business Profile Listing Page
Main dashboard page listing all businesses for a user.

### T3.1 Page Layout
- [ ] Create `/settings/businesses/page.tsx`
- [ ] List businesses in row format (similar to customer rows pattern)
- [ ] Show business name, location, operation count, completion status

### T3.2 Business Limit Enforcement
- [ ] Super-admin setting: maximum businesses per user (default: 3)
- [ ] Disable "Add Business" button when limit reached
- [ ] Show upgrade prompt when limit reached

### T3.3 Row Actions
- [ ] View button - navigate to business detail page
- [ ] Archive button - opens confirmation modal with type-in-name validation
- [ ] Archive = soft delete, permanently deleted after 3 months

---

## S4: Individual Business Profile Page
Dynamic page for each business with view and edit modes.

### T4.1 View/Edit Toggle
- [ ] Default to view mode
- [ ] Edit button switches to edit mode
- [ ] Save/Cancel buttons in edit mode

### T4.2 Company Official Details Section
- [ ] Company name and number
- [ ] Company address (multi-line)
- [ ] Company email and phone
- [ ] Website URL
- [ ] Business description

### T4.3 Account Yearly Rolling Setting
- [ ] Tax year start/end dates
- [ ] Fiscal year configuration

---

## S5: Business Operations
Operations for each business with country-specific tax details.

### T5.1 Operations List
- [ ] List all operations for a business
- [ ] Each operation shows: country, address, currency

### T5.2 Tax Details Panel
- [ ] Read-only display of auto-loaded tax details
- [ ] Cached for 7 days
- [ ] Shows: currency, tax % rates, tax types

### T5.3 Country-Based Auto-Tax Loading
- [ ] Map operation address to country
- [ ] Load country-specific tax defaults
- [ ] Manual override option

---

## S6: Tax & Accountancy Details
Preferences and settings for bookkeeping and accounting.

### T6.1 Prerequisites
- [ ] Tax preferences only available after at least one operation exists

### T6.2 Book/Accountancy Details
- [ ] Currency selection
- [ ] Tax dates configuration
- [ ] Reporting preferences

### T6.3 Financial Overview
- [ ] Total Revenue (manual entry or auto-calculated)
- [ ] Total Expenses breakdown:
  - [ ] Insurance
  - [ ] Loans & Leasing

---

## S7: Review & Validation Screen
Final review before completing business setup.

### T7.1 Setup Accuracy
- [ ] Calculate completion percentage
- [ ] Show completed sections count
- [ ] Highlight missing fields

### T7.2 Accountant Review Flags
- [ ] Loan principal repayment = not normal expense (flag unknown treatment)
- [ ] Loan interest = expense
- [ ] Credit card repayment should not duplicate underlying expenses (flag potential duplicates)
- [ ] Leasing requires accountant review if treatment is unknown
- [ ] Insurance may need business/private percentage split
- [ ] Tax settings flagged if estimated/uncertain

### T7.3 Review Display
- [ ] Setup Accuracy % prominently displayed
- [ ] Collapsible JSON preview for debugging
- [ ] Save Company Setup button
- [ ] Continue to Analysis button

---

## S8: User Flows & Navigation
Navigation structure and user experience flows.

### T8.1 Navigation Flow
1. User accesses Settings → Business Profiles
2. Lands on listing page showing all businesses
3. Each business row links to `/settings/businesses/[id]`
4. Business detail page shows view mode by default
5. Edit mode reveals all form fields
6. Final step: Review screen before completing setup

### T8.2 Archive Flow
- [ ] Click archive triggers confirmation dialog
- [ ] User must type business name to confirm
- [ ] Business moves to archived state
- [ ] 3-month grace period for recovery
- [ ] Permanent deletion after 3 months

### T8.3 Update Guides
- [ ] Update user guide documentation
- [ ] Update developer documentation for new schema


ADDITIONAL INFO:

Strong direction overall. Main improvement: keep V1 simpler and separate “business identity” from “tax/accountancy intelligence”.

Recommended adjustments:

Remove hardcoded “3 businesses” from backend logic → use subscription/plan capability system from start.
taxDetails (JSON) is too generic → split:
taxCountry
taxSystem
vatRegistered
vatNumber
taxMetadata JSON
Avoid storing auto-loaded tax rules directly in operation rows. Create separate:
CountryTaxProfile
cached centrally.
“Operation” naming may confuse users. Consider:
BusinessEntity
BusinessLocation
BusinessRegion
depending on actual meaning.
Do not implement permanent delete worker yet. Soft archive is enough for V1.
Review screen is very good differentiator for UseClevr.
Accountant review flags = strong feature, keep.
“Collapsible JSON debug” should be admin/dev only.
Revenue/Expenses manual entry should later connect to CSV/AI analysis automatically.
Add:
timezone
default currency
locale
invoice numbering preference
early in schema.
Add status:
draft
active
archived
instead of only active/archive/delete.
Add profile completion system as reusable engine, not business-only.

Most important architecture advice:

Business Profile = identity/configuration layer
AI Analysis = separate analytics layer
Tax Intelligence = separate cached service layer

Do not mix all into one giant business table/service early.
