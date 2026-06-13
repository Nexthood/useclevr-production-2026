import type { AfterListServerProps, BeforeListServerProps } from "payload"

function collectionLabel(props: BeforeListServerProps | AfterListServerProps) {
  return props.collectionConfig.slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function PayloadNavHeader() {
  return (
    <div className="payload-admin-nav-header">
      <span className="payload-admin-nav-header__eyebrow">Workspace</span>
      <strong>Main menu</strong>
      <span>Content and publishing</span>
    </div>
  )
}

export function PayloadDashboardHeader() {
  return (
    <header className="payload-admin-page-header">
      <span className="payload-admin-page-header__icon" aria-hidden="true">C</span>
      <div>
        <h1>Content admin</h1>
        <p>Manage public pages, news, FAQs, media, and content access.</p>
      </div>
    </header>
  )
}

export function PayloadDashboardInfo() {
  return (
    <aside className="payload-admin-info-rail" aria-label="Content workspace information">
      <section className="payload-admin-info-panel">
        <span className="payload-admin-info-panel__eyebrow">Workspace</span>
        <h2>Publishing guide</h2>
        <p>Use the main menu to open a content area. Review drafts and public copy before publishing.</p>
      </section>
      <section className="payload-admin-info-panel">
        <span className="payload-admin-info-panel__eyebrow">Dashboard</span>
        <h2>Product data</h2>
        <p>Customer, dataset, billing, and AI administration remain in the main UseClevr dashboard.</p>
        <a href="/app" target="_parent">Open dashboard</a>
      </section>
    </aside>
  )
}

export function PayloadListSubheader(props: BeforeListServerProps) {
  const label = collectionLabel(props)
  return (
    <div className="payload-admin-subheader">
      <div>
        <span className="payload-admin-subheader__eyebrow">Content area</span>
        <h2>{label}</h2>
      </div>
      <p>Search, filter, review, and manage {label.toLowerCase()} from this workspace.</p>
    </div>
  )
}

export function PayloadListInfo(props: AfterListServerProps) {
  const label = collectionLabel(props)
  return (
    <aside className="payload-admin-info-rail" aria-label={`${label} information`}>
      <section className="payload-admin-info-panel">
        <span className="payload-admin-info-panel__eyebrow">Current area</span>
        <h2>{label}</h2>
        <p>{props.data.totalDocs} record{props.data.totalDocs === 1 ? "" : "s"} available.</p>
      </section>
      <section className="payload-admin-info-panel">
        <span className="payload-admin-info-panel__eyebrow">Workflow</span>
        <h2>Before publishing</h2>
        <p>Confirm titles, public wording, links, dates, and media before making content visible.</p>
      </section>
    </aside>
  )
}
