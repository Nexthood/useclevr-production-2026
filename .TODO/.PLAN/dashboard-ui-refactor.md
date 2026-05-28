# Dashboard UI Refactor Plan

Status: planning only. Do not implement until reviewed and approved.

---

# Goal

Redesign the dashboard layout for consistent UX:

- Global topbar above sidebar
- Collapsible sidebar with account submenu
- Consistent table layouts across pages
- Sticky sidebars and footer for AI Assistant
- Action rows per page, not in header
- Clear, descriptive notices

---

# Key Changes

## Layout Structure

```
[Global Topbar - full width]
  ├─ Logo
  ├─ Hybrid AI
  ├─ Notices
  ├─ User profile submenu
  └─ Sign-out
[Sidebar (collapsible)]
  ├─ Main nav (Dashboard, Datasets, AI, etc.)
  └─ Account submenu
[Main Content Area]
  ├─ Page header
  ├─ Page content
  ├─ Action row (New, Upload, etc.)
  └─ Edit page action row
[AI Assistant]
  ├─ Left sidebar: Dataset selector (sticky)
  ├─ Main: Messages (scrollable)
  ├─ Right sidebar: Suggestions (sticky)
  └─ Footer: Chat input (sticky)
```

---

# Implementation Checklist

- [ ] Create global topbar component with sections
- [ ] Move settings links to account submenu
- [ ] Add account submenu to sidebar
- [ ] Update table layouts for consistency
- [ ] Add action rows to table pages
- [ ] Refactor AI Assistant layout
- [ ] Update sub-page bars (FAQ, Business, Tickets)
- [ ] Update notices to be descriptive
- [ ] Move Terms to footer
- [ ] Add footer with T&C, copyright, social links
- [ ] Update progress tracking
- [ ] Update documentation

---

# Files to Modify

- `src/components/layout/app-sidebar.tsx`
- `src/components/ui/topbar.tsx`
- `src/components/layout/dashboard-global-footer.tsx`
- `src/components/chat/ai-assistant-workspace.tsx`
- `src/components/ui/notice-bar.tsx`
- Table listing pages in `src/app/app/`
- Documentation files