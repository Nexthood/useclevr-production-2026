# UseClevr Screenshot Reference

This guide lists pages to capture for sales materials, onboarding guides, and product documentation.

## Public Pages

| Page | URL | Key Elements |
|------|-----|-------------|
| Homepage | `/` | Hero section, feature overview, pricing CTA |
| Pricing | `/pricing` | Plan comparison table, feature breakdown |
| FAQ | `/faq` | Accordion categories, open/close all |
| Contact | `/contact` | Contact form |
| Signup/Login | `/signup`, `/login` | Tabbed auth form, social login options |

## Dashboard Pages

| Page | URL | Key Elements |
|------|-----|-------------|
| Dashboard home | `/app` | Workspace overview, setup progress, quick actions |
| Upload | `/app/upload` | File upload area, format hints |
| Datasets | `/app/datasets` | Dataset listing table, action buttons |
| Dataset detail | `/app/datasets/[id]` | Data preview table, row count, column info |
| AI Assistant | `/app/assistant` | Chat interface, dataset selector, suggestions, history |
| Business overview | `/app/business` | Business listing, stats cards, review panel |
| Company Setup | `/app/business/setup` | Multi-step wizard, progress bar, accuracy score |
| Business Profile | `/app/business/profile` | Profile form with Identity, Contact, Operations sections |
| Accountancy | `/app/accountancy` | Bookkeeping cards, readiness status |
| Reports & Downloads | `/app/downloads` | Report listing, download buttons |
| Tickets | `/app/tickets` | Ticket queue, new ticket button |
| FAQ | `/app/faq` | Dashboard FAQ accordion |
| Settings / Profile | `/app/settings/profile` | Account settings form |
| Settings / Subscription | `/app/settings/subscription` | Plan display, billing status |

## Super-Admin Pages

| Page | URL | Key Elements |
|------|-----|-------------|
| Customers | `/app/admin/customers` | Customer listing table |
| AI Traces | `/app/admin/ai-traces` | Analytics dashboard, charts, top queries |
| AI Benchmarking | `/app/admin/ai-benchmarking` | Provider comparison table |
| Billing settings | `/app/admin/billing` | Billing configuration |
| Customer levels | `/app/admin/levels` | Level rules |
| Discount rules | `/app/admin/discounts` | Discount/referral configuration |

## Screenshot Standards

- **Resolution**: 1440×900 or 1920×1080
- **Theme**: Light mode (default), dark mode as secondary set
- **Format**: PNG
- **Naming**: `{page-name}-{variant}.png` (e.g., `dashboard-home-light.png`)
- **No sensitive data**: Use demo datasets only, blur any user-identifiable info
- **Consistent viewport**: Same browser width for all dashboard captures

## Priority Order

1. Homepage hero + feature section
2. Pricing page
3. Upload with demo dataset pre-selected
4. AI Assistant with one question answered
5. Business Company Setup wizard (step 3-4 visible)
6. Dataset detail with data preview
7. Accountancy overview
8. Business overview with review panel
9. AI Trace Analytics (superadmin)
10. FAQ accordion (public)
