"use client"

import { Modal } from "@/components/ui/modal"
import { useAuth } from "@payloadcms/ui"
import {
  Archive,
  BarChart3,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  Database,
  Eye,
  FileText,
  Landmark,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

const API_ROOT = "/api/payload/admin-operations"

type CmsAdminUser = { role?: "base" | "superadmin" }

type DashboardUser = {
  id: string
  email: string | null
  name: string | null
  businessCount?: number
}

type BusinessRow = {
  id: string
  userId: string
  ownerEmail: string
  ownerName: string | null
  name: string
  email: string | null
  industry: string | null
  address: string | null
  website: string | null
  description: string | null
  companyNumber: string | null
  status: "draft" | "active" | "archived"
  isPrimary: boolean
  entityCount: number
  completionPercent: number
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  countryOfRegistration: string
  taxResidenceCountry: string
  legalStructure: string
  accountingMethod: string
  taxRegistered: string
  taxType: string
  standardTaxRate: string
  primaryCurrency: string
  reportingCurrency: string
}

type DatasetRow = {
  id: string
  userId: string
  ownerEmail: string
  ownerName: string | null
  name: string
  fileName: string
  fileSize: number | null
  rowCount: number
  columnCount: number
  columns: string[]
  analysisStatus: string
  status: string
  createdAt: string
  updatedAt: string
}

type DatasetPreviewRow = {
  rowIndex: number
  data: Record<string, unknown>
}

type AccountancySnapshot = {
  users: DashboardUser[]
  businesses: { id: string; name: string; status: string; isPrimary: boolean }[]
  selectedUserId: string
  selectedBusinessId: string
  metrics: {
    totalBusinesses: number
    totalDatasets: number
    totalRows: number
    readiness: number
  }
  financialSettings: { currency: string; numberFormat: string }
  business: {
    id: string
    name: string
    industry: string
    location: string
    status: string
  } | null
  setup: {
    companyInfo: {
      countryOfRegistration: string
      taxResidenceCountry: string
      legalStructure: string
      accountingMethod: string
    }
    taxSettings: {
      taxRegistered: string
      taxType: string
      standardTaxRate: string
    }
    setupStatus: {
      setupAccuracy: number
      completedSections: string[]
      missingFields: string[]
      accountantReviewFlags: string[]
    }
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(body.error || "The admin request failed.")
  return body
}

function OperationHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <header className="payload-operation-header">
      <nav className="payload-breadcrumbs" aria-label="Breadcrumb">
        <a href="/admin">Admin</a>
        <span className="payload-breadcrumbs__sep">/</span>
        <span className="payload-breadcrumbs__current">{eyebrow}</span>
      </nav>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  )
}

function StatusMessage({ error, message }: { error: string; message: string }) {
  if (!error && !message) return null
  return (
    <div className={`payload-operation-notice${error ? " is-error" : ""}`} role="status">
      {error || message}
    </div>
  )
}

function Spinner() {
  return <span className="payload-spinner" aria-label="Loading..." />
}

export function PayloadOperationsNav() {
  const { user } = useAuth<CmsAdminUser>()
  if (user?.role !== "superadmin") return null

  return (
    <nav className="payload-operation-nav" aria-label="Product operations">
      <span>Product operations</span>
      <a href="/admin/business-profiles">
        <Building2 className="payload-nav-icon" /> Business profiles
      </a>
      <a href="/admin/accountancy">
        <BookOpenCheck className="payload-nav-icon" /> Accountancy
      </a>
      <a href="/admin/datasets">
        <Database className="payload-nav-icon" /> Datasets
      </a>
      <a href="/admin/dataset-upload">
        <Upload className="payload-nav-icon" /> Upload dataset
      </a>
    </nav>
  )
}

// ─── BUSINESS PROFILES VIEW ───────────────────────────────────────────────────

export function PayloadBusinessProfilesView() {
  const { user } = useAuth<CmsAdminUser>()
  if (user?.role !== "superadmin") return <PayloadOperatorAccessDenied />
  return <PayloadBusinessProfilesWorkspace />
}

function PayloadBusinessProfilesWorkspace() {
  const [businesses, setBusinesses] = useState<BusinessRow[]>([])
  const [users, setUsers] = useState<DashboardUser[]>([])
  const [selected, setSelected] = useState<Partial<BusinessRow> | null>(null)
  const [detailBusiness, setDetailBusiness] = useState<BusinessRow | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<"business" | "setup">("business")

  const load = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const response = await fetch(`${API_ROOT}/businesses`, {
        credentials: "include",
        cache: "no-store",
      })
      const data = await readResponse<{ businesses: BusinessRow[]; users: DashboardUser[] }>(
        response,
      )
      setBusinesses(data.businesses)
      setUsers(data.users)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load business profiles.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = search
    ? businesses.filter(
        (b) =>
          b.name.toLowerCase().includes(search.toLowerCase()) ||
          b.ownerEmail.toLowerCase().includes(search.toLowerCase()) ||
          (b.industry || "").toLowerCase().includes(search.toLowerCase()),
      )
    : businesses

  const focusBusiness = (focusId ? filtered.find((b) => b.id === focusId) : null) || filtered[0] || null
  const totalEntities = businesses.reduce((sum, b) => sum + b.entityCount, 0)

  function getSectionCounts(b: BusinessRow) {
    const identity = ["name", "industry", "description"].filter(
      (f) => String(b[f as keyof typeof b] || "").trim().length > 0,
    ).length
    const contact = ["email", "website"].filter(
      (f) => String(b[f as keyof typeof b] || "").trim().length > 0,
    ).length
    const ops = ["address"].filter(
      (f) => String(b[f as keyof typeof b] || "").trim().length > 0,
    ).length
    return {
      identity: { filled: identity, total: 3 },
      contact: { filled: contact, total: 2 },
      operations: { filled: ops, total: 1 },
    }
  }

  function getReviewFlags(b: BusinessRow) {
    return [
      {
        label: "Business identity",
        complete: Boolean(b.name?.trim() && b.industry?.trim()),
        help: "Add a company name and industry so reports use the right business context.",
      },
      {
        label: "Contact details",
        complete: Boolean(b.email?.includes("@") && b.website?.trim()),
        help: "Add a company email and website for support, reports, and future customer-facing outputs.",
      },
      {
        label: "Operating location",
        complete: Boolean(b.address?.trim()),
        help: "Add the primary location so currency, tax, and region assumptions can be reviewed.",
      },
      {
        label: "Analysis context",
        complete: (b.description?.trim().length ?? 0) >= 40,
        help: "Add a short description with what the company sells, who it serves, and how it earns revenue.",
      },
    ]
  }

  function openCreate() {
    setSelected({})
    setIsFormOpen(true)
  }

  function openEdit(business: BusinessRow) {
    setSelected(business)
    setIsFormOpen(true)
  }

  async function openDetail(business: BusinessRow) {
    setDetailBusiness(business)
    setIsDetailOpen(true)
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError("")
    setMessage("")
    try {
      const formData = new FormData(event.currentTarget)
      const response = await fetch(`${API_ROOT}/businesses`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData)),
      })
      await readResponse(response)
      setMessage(selected?.id ? "Business profile updated." : "Business profile created.")
      setIsFormOpen(false)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the business profile.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleArchive(id: string) {
    if (!confirm("Archive this business profile? Archived businesses are deleted after 90 days."))
      return
    setError("")
    setMessage("")
    try {
      await fetch(`${API_ROOT}/businesses/${id}/archive`, {
        method: "POST",
        credentials: "include",
      })
      setMessage("Business profile archived.")
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not archive the business.")
    }
  }

  async function handleRestore(id: string) {
    setError("")
    setMessage("")
    try {
      await fetch(`${API_ROOT}/businesses/${id}/restore`, {
        method: "POST",
        credentials: "include",
      })
      setMessage("Business profile restored.")
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not restore the business.")
    }
  }

  async function handleDelete(id: string) {
    if (
      !confirm(
        "Permanently delete this archived business? This action cannot be undone.",
      )
    )
      return
    setError("")
    setMessage("")
    try {
      await fetch(`${API_ROOT}/businesses/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      setMessage("Business profile deleted.")
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete the business.")
    }
  }

  const sectionCounts = focusBusiness ? getSectionCounts(focusBusiness) : null
  const reviewFlags = focusBusiness ? getReviewFlags(focusBusiness) : []
  const completedFlags = reviewFlags.filter((f) => f.complete).length

  function ProgressBar({ pct, size = "sm" }: { pct: number; size?: "sm" | "md" }) {
    return (
      <div className={`payload-progress ${size === "md" ? "is-md" : "is-sm"}`}>
        <div className="payload-progress-track">
          <div
            className={`payload-progress-fill${pct >= 100 ? " is-complete" : ""}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="payload-progress-label">{pct}%</span>
      </div>
    )
  }

  return (
    <main className="payload-admin-operation-view">
      <StatusMessage error={error} message={message} />

      <div className="template-default">
        <div className="dashboard">
          {/* ─── Page header ─── */}
          <div className="payload-admin-page-header">
            <div className="payload-admin-page-header__icon">
              <Building2 size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="payload-admin-nav-header__eyebrow">Product operations</div>
              <h1>Business profiles</h1>
              <p>Manage business profiles for dashboard accounts. {filtered.length} profile{filtered.length !== 1 ? "s" : ""} across {users.length} user{users.length !== 1 ? "s" : ""}.</p>
            </div>
          </div>

          {/* ─── Main content column ─── */}
          <div>
            {/* Subpage nav tabs */}
            <div className="payload-admin-subheader" style={{ marginBottom: "1rem" }}>
              <div className="payload-operation-tabs" style={{ margin: 0, border: 0, padding: 0 }}>
                <button
                  type="button"
                  className={activeTab === "business" ? "is-active" : ""}
                  onClick={() => setActiveTab("business")}
                >
                  <Building2 size={14} /> Business
                </button>
                <button
                  type="button"
                  className={activeTab === "setup" ? "is-active" : ""}
                  onClick={() => setActiveTab("setup")}
                >
                  <FileText size={14} /> Setup
                </button>
              </div>
              <p>{focusBusiness ? `Selected: ${focusBusiness.name}` : ""}</p>
            </div>

            {activeTab === "business" && (
              <>
                {/* Toolbar */}
                <div className="payload-operation-toolbar">
                  <div className="payload-operation-search">
                    <input
                      type="text"
                      placeholder="Search by name, owner, industry..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="payload-operation-toolbar-actions">
                    <span className="payload-operation-count">
                      {isLoading ? "..." : filtered.length} business
                      {filtered.length !== 1 ? "es" : ""}
                    </span>
                    <button type="button" onClick={openCreate}>
                      <Plus size={16} /> Add business
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="payload-operation-table-wrap">
                  <table className="payload-operation-table">
                    <thead>
                      <tr>
                        <th>Business</th>
                        <th>Owner</th>
                        <th>Industry</th>
                        <th>Status</th>
                        <th>Completion</th>
                        <th>Updated</th>
                        <th>
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={7}>
                            <Spinner /> Loading business profiles...
                          </td>
                        </tr>
                      ) : filtered.length === 0 ? (
                        <tr>
                          <td colSpan={7}>
                            {search ? "No businesses match your search." : "No business profiles are available."}
                          </td>
                        </tr>
                      ) : (
                        filtered.map((business) => (
                          <tr
                            key={business.id}
                            className={`${business.status === "archived" ? "is-inactive" : ""}${focusId === business.id ? " is-hovered" : ""}`}
                            onMouseEnter={() => setFocusId(business.id)}
                          >
                            <td>
                              <strong>{business.name}</strong>
                              {business.email && <small>{business.email}</small>}
                              {business.isPrimary && <span className="payload-badge">Primary</span>}
                            </td>
                            <td>{business.ownerEmail}</td>
                            <td>{business.industry || <span className="payload-empty">Not set</span>}</td>
                            <td>
                              <span className={`payload-operation-status is-${business.status}`}>
                                {business.status}
                              </span>
                            </td>
                            <td>
                              <ProgressBar pct={business.completionPercent} />
                            </td>
                            <td>
                              {new Date(business.updatedAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </td>
                            <td>
                              <div className="payload-operation-row-actions">
                                <button
                                  type="button"
                                  className="payload-action-icon"
                                  onClick={() => openDetail(business)}
                                  title="View details"
                                >
                                  <Eye size={16} />
                                </button>
                                <button
                                  type="button"
                                  className="payload-action-icon"
                                  onClick={() => openEdit(business)}
                                  title="Edit"
                                >
                                  <Building2 size={16} />
                                </button>
                                {business.status !== "archived" ? (
                                  <button
                                    type="button"
                                    className="payload-action-icon is-warning"
                                    onClick={() => handleArchive(business.id)}
                                    title="Archive"
                                  >
                                    <Archive size={16} />
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className="payload-action-icon"
                                      onClick={() => handleRestore(business.id)}
                                      title="Restore"
                                    >
                                      <RotateCcw size={16} />
                                    </button>
                                    {!business.isPrimary && (
                                      <button
                                        type="button"
                                        className="payload-action-icon is-danger"
                                        onClick={() => handleDelete(business.id)}
                                        title="Delete permanently"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activeTab === "setup" && (
              <div className="payload-operation-card">
                <p style={{ color: "var(--theme-elevation-600)", fontSize: "0.8rem" }}>
                  Company setup details for <strong>{focusBusiness?.name || "the selected business"}</strong>.
                  Edit the business profile to update these fields.
                </p>
                {focusBusiness && (
                  <div className="payload-detail-grid" style={{ marginTop: "1rem" }}>
                    <div>
                      <dt>Country of registration</dt>
                      <dd>{focusBusiness.countryOfRegistration || <span className="payload-empty">Not set</span>}</dd>
                    </div>
                    <div>
                      <dt>Tax residence</dt>
                      <dd>{focusBusiness.taxResidenceCountry || <span className="payload-empty">Not set</span>}</dd>
                    </div>
                    <div>
                      <dt>Legal structure</dt>
                      <dd>{focusBusiness.legalStructure || <span className="payload-empty">Not set</span>}</dd>
                    </div>
                    <div>
                      <dt>Accounting method</dt>
                      <dd>{focusBusiness.accountingMethod || <span className="payload-empty">Not set</span>}</dd>
                    </div>
                    <div>
                      <dt>Tax registered</dt>
                      <dd>{focusBusiness.taxRegistered || <span className="payload-empty">Not set</span>}</dd>
                    </div>
                    <div>
                      <dt>Tax type</dt>
                      <dd>{focusBusiness.taxType || <span className="payload-empty">Not set</span>}</dd>
                    </div>
                    <div>
                      <dt>Standard tax rate</dt>
                      <dd>{focusBusiness.standardTaxRate ? `${focusBusiness.standardTaxRate}%` : <span className="payload-empty">Not set</span>}</dd>
                    </div>
                    <div>
                      <dt>Primary currency</dt>
                      <dd>{focusBusiness.primaryCurrency || <span className="payload-empty">Not set</span>}</dd>
                    </div>
                    <div>
                      <dt>Reporting currency</dt>
                      <dd>{focusBusiness.reportingCurrency || <span className="payload-empty">Not set</span>}</dd>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── Right info rail ─── */}
          <div className="payload-admin-info-rail">
            {/* Overview */}
            <div className="payload-admin-info-panel">
              <div className="payload-admin-info-panel__eyebrow">Overview</div>
              <h2>Statistics</h2>
              <div className="payload-info-stats">
                <div className="payload-info-stat">
                  <Building2 size={14} />
                  <span>{businesses.length} profile{businesses.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="payload-info-stat">
                  <Database size={14} />
                  <span>{totalEntities} entit{totalEntities === 1 ? "y" : "ies"}</span>
                </div>
              </div>
            </div>

            {/* Profile summary */}
            {sectionCounts && (
              <div className="payload-admin-info-panel">
                <div className="payload-admin-info-panel__eyebrow">Profile summary</div>
                <h2>{focusBusiness?.name || "Business"}</h2>
                <div className="payload-info-stats">
                  <div className="payload-info-stat">
                    <span>Identity</span>
                    <span>{sectionCounts.identity.filled}/{sectionCounts.identity.total}</span>
                  </div>
                  <div className="payload-info-stat">
                    <span>Contact</span>
                    <span>{sectionCounts.contact.filled}/{sectionCounts.contact.total}</span>
                  </div>
                  <div className="payload-info-stat">
                    <span>Operations</span>
                    <span>{sectionCounts.operations.filled}/{sectionCounts.operations.total}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Review */}
            {focusBusiness && (
              <div className="payload-admin-info-panel">
                <div className="payload-admin-info-panel__eyebrow">Review</div>
                <h2>Profile completion</h2>
                <ProgressBar pct={focusBusiness.completionPercent} size="md" />
                <div className="payload-info-flags">
                  <div className="payload-info-flags-summary">
                    {completedFlags}/{reviewFlags.length} items complete
                  </div>
                  {reviewFlags.map((flag) => (
                    <div key={flag.label} className={`payload-info-flag${flag.complete ? " is-complete" : ""}`}>
                      <CheckCircle2 size={14} className={flag.complete ? "is-complete" : "is-open"} />
                      <div>
                        <strong>{flag.label}</strong>
                        <p>{flag.complete ? "Complete" : flag.help}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        title={selected?.id ? "Edit business profile" : "Add business profile"}
        description="Changes apply to the selected dashboard user's business data."
      >
        <form className="payload-operation-form" onSubmit={handleSave}>
          <input type="hidden" name="id" value={selected?.id || ""} />
          <label>
            Dashboard owner
            <select name="userId" required defaultValue={selected?.userId || ""}>
              <option value="">Select an owner</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email || user.name || user.id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Business name
            <input name="name" required defaultValue={selected?.name || ""} />
          </label>
          <label>
            Company number
            <input name="companyNumber" defaultValue={selected?.companyNumber || ""} />
          </label>
          <label>
            Business email
            <input name="email" type="email" defaultValue={selected?.email || ""} />
          </label>
          <label>
            Industry
            <input name="industry" defaultValue={selected?.industry || ""} />
          </label>
          <label>
            Location / Address
            <input name="address" defaultValue={selected?.address || ""} />
          </label>
          <label>
            Website
            <input name="website" type="url" defaultValue={selected?.website || ""} />
          </label>
          <label>
            Status
            <select name="status" defaultValue={selected?.status || "draft"}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label>
            Country of registration
            <input
              name="countryOfRegistration"
              defaultValue={selected?.countryOfRegistration || ""}
            />
          </label>
          <label>
            Tax residence
            <input
              name="taxResidenceCountry"
              defaultValue={selected?.taxResidenceCountry || ""}
            />
          </label>
          <label>
            Legal structure
            <select name="legalStructure" defaultValue={selected?.legalStructure || ""}>
              <option value="">Not set</option>
              <option value="sole_proprietor">Sole proprietor</option>
              <option value="limited_liability">Limited liability company</option>
              <option value="corporation">Corporation</option>
              <option value="partnership">Partnership</option>
              <option value="non_profit">Non-profit</option>
              <option value="other">Other</option>
              <option value="not_sure">Not sure</option>
            </select>
          </label>
          <label>
            Accounting method
            <select name="accountingMethod" defaultValue={selected?.accountingMethod || ""}>
              <option value="">Not set</option>
              <option value="cash">Cash basis</option>
              <option value="accrual">Accrual basis</option>
              <option value="not_sure">Not sure</option>
            </select>
          </label>
          <label>
            Tax registered
            <select name="taxRegistered" defaultValue={selected?.taxRegistered || ""}>
              <option value="">Not set</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="not_sure">Not sure</option>
            </select>
          </label>
          <label>
            Tax type
            <select name="taxType" defaultValue={selected?.taxType || ""}>
              <option value="">Not set</option>
              <option value="vat">VAT</option>
              <option value="gst">GST</option>
              <option value="sales_tax">Sales tax</option>
              <option value="none">None</option>
              <option value="not_sure">Not sure</option>
            </select>
          </label>
          <label>
            Standard tax rate (%)
            <input
              name="standardTaxRate"
              inputMode="decimal"
              defaultValue={selected?.standardTaxRate || ""}
            />
          </label>
          <label>
            Primary currency
            <input name="primaryCurrency" defaultValue={selected?.primaryCurrency || ""} />
          </label>
          <label>
            Reporting currency
            <input name="reportingCurrency" defaultValue={selected?.reportingCurrency || ""} />
          </label>
          <label className="is-wide">
            Description
            <textarea name="description" rows={5} defaultValue={selected?.description || ""} />
          </label>
          <div className="payload-operation-form-actions">
            <button type="button" className="is-secondary" onClick={() => setIsFormOpen(false)}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save business profile"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      {detailBusiness && (
        <Modal
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          title={detailBusiness.name}
          description="Business profile details."
        >
          <BusinessDetailCard business={detailBusiness} onEdit={() => {
            setIsDetailOpen(false)
            openEdit(detailBusiness)
          }} />
        </Modal>
      )}
    </main>
  )
}

function BusinessDetailCard({
  business,
  onEdit,
}: {
  business: BusinessRow
  onEdit: () => void
}) {
  return (
    <div className="payload-detail-card">
      <div className="payload-detail-grid">
        <div>
          <dt>Owner</dt>
          <dd>
            {business.ownerName ? `${business.ownerName} (` : ""}
            {business.ownerEmail}
            {business.ownerName ? ")" : ""}
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <span className={`payload-operation-status is-${business.status}`}>
              {business.status}
            </span>
          </dd>
        </div>
        <div>
          <dt>Industry</dt>
          <dd>{business.industry || <span className="payload-empty">Not set</span>}</dd>
        </div>
        <div>
          <dt>Company number</dt>
          <dd>{business.companyNumber || <span className="payload-empty">Not set</span>}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{business.email || <span className="payload-empty">Not set</span>}</dd>
        </div>
        <div>
          <dt>Website</dt>
          <dd>
            {business.website ? (
              <a href={business.website} target="_blank" rel="noopener noreferrer">
                {business.website}
              </a>
            ) : (
              <span className="payload-empty">Not set</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Address</dt>
          <dd>{business.address || <span className="payload-empty">Not set</span>}</dd>
        </div>
        <div>
          <dt>Primary business</dt>
          <dd>{business.isPrimary ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt>Entities</dt>
          <dd>{business.entityCount}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{new Date(business.createdAt).toLocaleDateString()}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{new Date(business.updatedAt).toLocaleDateString()}</dd>
        </div>
        {business.archivedAt && (
          <div>
            <dt>Archived</dt>
            <dd>{new Date(business.archivedAt).toLocaleDateString()}</dd>
          </div>
        )}
      </div>
      {business.description && (
        <div className="payload-detail-section">
          <dt>Description</dt>
          <dd>{business.description}</dd>
        </div>
      )}
      <div className="payload-operation-form-actions">
        <button type="button" onClick={onEdit}>
          Edit profile
        </button>
      </div>
    </div>
  )
}

// ─── ACCOUNTANCY VIEW ─────────────────────────────────────────────────────────

export function PayloadAccountancyView() {
  const { user } = useAuth<CmsAdminUser>()
  if (user?.role !== "superadmin") return <PayloadOperatorAccessDenied />
  return <PayloadAccountancyWorkspace />
}

function PayloadAccountancyWorkspace() {
  const [snapshot, setSnapshot] = useState<AccountancySnapshot | null>(null)
  const [userId, setUserId] = useState("")
  const [businessId, setBusinessId] = useState("")
  const [section, setSection] = useState<"overview" | "reporting" | "tax" | "compliance">(
    "overview",
  )
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async (nextUserId = userId, nextBusinessId = businessId) => {
    setIsLoading(true)
    setError("")
    try {
      const query = new URLSearchParams()
      if (nextUserId) query.set("userId", nextUserId)
      if (nextBusinessId) query.set("businessId", nextBusinessId)
      const response = await fetch(`${API_ROOT}/accountancy?${query.toString()}`, {
        credentials: "include",
        cache: "no-store",
      })
      const data = await readResponse<AccountancySnapshot>(response)
      setSnapshot(data)
      setUserId(data.selectedUserId)
      setBusinessId(data.selectedBusinessId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load accountancy data.")
    } finally {
      setIsLoading(false)
    }
  }, [businessId, userId])

  useEffect(() => {
    void load()
  }, [])

  const setup = snapshot?.setup
  const business = snapshot?.business
  const profileComplete = Boolean(business?.name && business.industry && business.location)
  const checks = [
    {
      label: "Business profile",
      complete: profileComplete,
      help: "Set the business name, industry, and operating location.",
    },
    {
      label: "Operating location",
      complete: Boolean(business?.location),
      help: "Add an operating or tax-residence location.",
    },
    {
      label: "Industry context",
      complete: Boolean(business?.industry),
      help: "Set the industry used for reporting and tax context.",
    },
    {
      label: "Tax registration",
      complete: Boolean(setup?.taxSettings.taxRegistered),
      help: "Set the tax-registration status in the business profile.",
    },
  ]

  return (
    <main className="payload-admin-operation-view">
      <OperationHeader
        eyebrow="Product operations"
        title="Accountancy"
        description="Review bookkeeping readiness, reporting volume, tax context, and compliance for dashboard accounts."
      />
      <StatusMessage error={error} message="" />

      <div className="payload-operation-toolbar">
        <div className="payload-operation-toolbar-actions">
          <label>
            <span className="sr-only">Dashboard account</span>
            <select
              value={userId}
              onChange={(event) => {
                const nextUserId = event.target.value
                setUserId(nextUserId)
                setBusinessId("")
                void load(nextUserId, "")
              }}
            >
              {(snapshot?.users || []).map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email || user.name || user.id}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Business profile</span>
            <select
              value={businessId}
              onChange={(event) => {
                const nextBusinessId = event.target.value
                setBusinessId(nextBusinessId)
                void load(userId, nextBusinessId)
              }}
              disabled={!snapshot?.businesses.length}
            >
              {(snapshot?.businesses || []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}{item.isPrimary ? " (Primary)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="payload-operation-tabs" role="tablist" aria-label="Accountancy sections">
        {(["overview", "reporting", "tax", "compliance"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={section === item ? "is-active" : ""}
            onClick={() => setSection(item)}
          >
            {item.charAt(0).toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="payload-operation-empty"><Spinner /> Loading accountancy workspace...</div>
      ) : !snapshot ? null : (
        <div className="payload-operation-card-grid">
          {section === "overview" && (
            <>
              <AccountancyMetric
                icon={Building2}
                label="Business profiles"
                value={snapshot.metrics.totalBusinesses.toLocaleString()}
              />
              <AccountancyMetric
                icon={Database}
                label="Connected datasets"
                value={snapshot.metrics.totalDatasets.toLocaleString()}
              />
              <AccountancyMetric
                icon={CheckCircle2}
                label="Close readiness"
                value={`${snapshot.metrics.readiness}%`}
              />
              <AccountancyPanel title="Selected business" icon={BookOpenCheck}>
                <p><strong>{business?.name || "No business profile"}</strong></p>
                <p>{business?.industry || "Industry not set"}</p>
                <p>{business?.location || "Location not set"}</p>
              </AccountancyPanel>
              <AccountancyPanel title="Financial settings" icon={Landmark}>
                <p>Currency: <strong>{snapshot.financialSettings.currency}</strong></p>
                <p>Number format: <strong>{snapshot.financialSettings.numberFormat}</strong></p>
                <p>Accounting method: <strong>{setup?.companyInfo.accountingMethod || "Not set"}</strong></p>
              </AccountancyPanel>
            </>
          )}

          {section === "reporting" && (
            <>
              <AccountancyMetric
                icon={BarChart3}
                label="Datasets"
                value={snapshot.metrics.totalDatasets.toLocaleString()}
              />
              <AccountancyMetric
                icon={FileText}
                label="Imported rows"
                value={snapshot.metrics.totalRows.toLocaleString()}
              />
              <AccountancyMetric
                icon={CheckCircle2}
                label="Analysis-ready datasets"
                value={snapshot.metrics.totalDatasets.toLocaleString()}
              />
              <AccountancyPanel title="Reporting status" icon={BarChart3}>
                <p>
                  {snapshot.metrics.totalDatasets > 0
                    ? "Financial records are available for dashboard analysis and reporting."
                    : "Upload a financial dataset for this account to enable reporting."}
                </p>
                <a href="/admin/dataset-upload">Upload financial data</a>
              </AccountancyPanel>
            </>
          )}

          {section === "tax" && (
            <>
              <AccountancyPanel title="Tax context" icon={Landmark}>
                <p>Tax residence: <strong>{setup?.companyInfo.taxResidenceCountry || business?.location || "Not set"}</strong></p>
                <p>Registration: <strong>{setup?.taxSettings.taxRegistered || "Not set"}</strong></p>
                <p>Tax type: <strong>{setup?.taxSettings.taxType || "Not set"}</strong></p>
                <p>Standard rate: <strong>{setup?.taxSettings.standardTaxRate ? `${setup.taxSettings.standardTaxRate}%` : "Not set"}</strong></p>
              </AccountancyPanel>
              <AccountancyPanel title="Review warnings" icon={FileText}>
                {setup?.setupStatus.accountantReviewFlags.length ? (
                  <ul>
                    {setup.setupStatus.accountantReviewFlags.map((flag) => <li key={flag}>{flag}</li>)}
                  </ul>
                ) : (
                  <p>No accountant-review warnings are recorded.</p>
                )}
              </AccountancyPanel>
            </>
          )}

          {section === "compliance" && (
            <>
              <AccountancyMetric
                icon={CheckCircle2}
                label="Setup accuracy"
                value={`${setup?.setupStatus.setupAccuracy || 0}%`}
              />
              <AccountancyPanel title="Compliance checklist" icon={CheckCircle2}>
                <div className="payload-accountancy-checks">
                  {checks.map((check) => (
                    <div key={check.label}>
                      <CheckCircle2 className={check.complete ? "is-complete" : "is-open"} size={18} />
                      <div>
                        <strong>{check.label}</strong>
                        <p>{check.complete ? "Complete" : check.help}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </AccountancyPanel>
            </>
          )}
        </div>
      )}
    </main>
  )
}

function AccountancyMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; size?: number }>
  label: string
  value: string
}) {
  return (
    <section className="payload-operation-metric">
      <Icon className="payload-nav-icon" />
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </section>
  )
}

function AccountancyPanel({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string; size?: number }>
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="payload-accountancy-panel">
      <header><Icon size={18} /><h2>{title}</h2></header>
      <div>{children}</div>
    </section>
  )
}

// ─── DATASETS VIEW ────────────────────────────────────────────────────────────

export function PayloadDatasetsView() {
  const { user } = useAuth<CmsAdminUser>()
  if (user?.role !== "superadmin") return <PayloadOperatorAccessDenied />
  return <PayloadDatasetsWorkspace />
}

function PayloadDatasetsWorkspace() {
  const [datasets, setDatasets] = useState<DatasetRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [search, setSearch] = useState("")
  const [selectedDataset, setSelectedDataset] = useState<DatasetRow | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [preview, setPreview] = useState<DatasetPreviewRow[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const response = await fetch(`${API_ROOT}/datasets`, {
        credentials: "include",
        cache: "no-store",
      })
      const data = await readResponse<{ datasets: DatasetRow[]; users: DashboardUser[] }>(response)
      setDatasets(data.datasets)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load datasets.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = search
    ? datasets.filter(
        (d) =>
          d.name.toLowerCase().includes(search.toLowerCase()) ||
          d.ownerEmail.toLowerCase().includes(search.toLowerCase()),
      )
    : datasets

  async function openDetail(dataset: DatasetRow) {
    setSelectedDataset(dataset)
    setIsDetailOpen(true)
    setPreviewLoading(true)
    try {
      const response = await fetch(`${API_ROOT}/datasets/${dataset.id}/preview?limit=10`, {
        credentials: "include",
      })
      const data = await readResponse<{ rows: DatasetPreviewRow[] }>(response)
      setPreview(data.rows)
    } catch {
      setPreview([])
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Permanently delete dataset "${name}"? This cannot be undone.`)) return
    setIsDeleting(id)
    setError("")
    setMessage("")
    try {
      await fetch(`${API_ROOT}/datasets/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      setMessage(`Dataset "${name}" deleted.`)
      if (selectedDataset?.id === id) {
        setIsDetailOpen(false)
        setSelectedDataset(null)
      }
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete the dataset.")
    } finally {
      setIsDeleting(null)
    }
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes) return "Unknown"
    const mb = bytes / (1024 * 1024)
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`
  }

  return (
    <main className="payload-admin-operation-view">
      <OperationHeader
        eyebrow="Product operations"
        title="Datasets"
        description="View and manage uploaded datasets for dashboard accounts."
      />
      <StatusMessage error={error} message={message} />

      <div className="payload-operation-toolbar">
        <div className="payload-operation-search">
          <input
            type="text"
            placeholder="Search by name or owner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="payload-operation-toolbar-actions">
          <span className="payload-operation-count">
            {isLoading ? "..." : filtered.length} dataset{filtered.length !== 1 ? "s" : ""}
          </span>
          <a href="/admin/dataset-upload" className="payload-button">
            <Upload size={16} /> Upload dataset
          </a>
        </div>
      </div>

      <div className="payload-operation-table-wrap">
        <table className="payload-operation-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Owner</th>
              <th>Size</th>
              <th>Rows / Columns</th>
              <th>Status</th>
              <th>Uploaded</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7}>
                  <Spinner /> Loading datasets...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  {search ? "No datasets match your search." : "No datasets are available."}
                </td>
              </tr>
            ) : (
              filtered.map((dataset) => (
                <tr key={dataset.id}>
                  <td>
                    <strong>{dataset.name}</strong>
                    <small>{dataset.fileName}</small>
                  </td>
                  <td>{dataset.ownerEmail}</td>
                  <td>{formatFileSize(dataset.fileSize)}</td>
                  <td>
                    {dataset.rowCount.toLocaleString()} / {dataset.columnCount}
                  </td>
                  <td>
                    <span className={`payload-operation-status is-${dataset.analysisStatus === "ready" || dataset.analysisStatus === "completed" ? "active" : "draft"}`}>
                      {dataset.analysisStatus}
                    </span>
                  </td>
                  <td>
                    {new Date(dataset.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td>
                    <div className="payload-operation-row-actions">
                      <button
                        type="button"
                        className="payload-action-icon"
                        onClick={() => openDetail(dataset)}
                        title="View details"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        type="button"
                        className="payload-action-icon is-danger"
                        onClick={() => handleDelete(dataset.id, dataset.name)}
                        disabled={isDeleting === dataset.id}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Dataset Detail Modal */}
      {selectedDataset && (
        <Modal
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          title={selectedDataset.name}
          description={`${selectedDataset.rowCount.toLocaleString()} rows, ${selectedDataset.columnCount} columns`}
        >
          <div className="payload-detail-card">
            <div className="payload-detail-grid">
              <div>
                <dt>Owner</dt>
                <dd>
                  {selectedDataset.ownerName ? `${selectedDataset.ownerName} (` : ""}
                  {selectedDataset.ownerEmail}
                  {selectedDataset.ownerName ? ")" : ""}
                </dd>
              </div>
              <div>
                <dt>File</dt>
                <dd>{selectedDataset.fileName}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{formatFileSize(selectedDataset.fileSize)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{selectedDataset.analysisStatus}</dd>
              </div>
              <div>
                <dt>Uploaded</dt>
                <dd>{new Date(selectedDataset.createdAt).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{new Date(selectedDataset.updatedAt).toLocaleDateString()}</dd>
              </div>
            </div>

            {selectedDataset.columns.length > 0 && (
              <div className="payload-detail-section">
                <dt>Columns ({selectedDataset.columnCount})</dt>
                <dd className="payload-column-list">
                  {selectedDataset.columns.map((col) => (
                    <span key={col} className="payload-chip">{col}</span>
                  ))}
                </dd>
              </div>
            )}

            <div className="payload-detail-section">
              <dt>Data preview</dt>
              <dd>
                {previewLoading ? (
                  <Spinner />
                ) : preview.length === 0 ? (
                  <span className="payload-empty">No preview available</span>
                ) : (
                  <div className="payload-preview-table-wrap">
                    <table className="payload-preview-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          {selectedDataset.columns.map((col) => (
                            <th key={col}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row) => (
                          <tr key={row.rowIndex}>
                            <td>{row.rowIndex + 1}</td>
                            {selectedDataset.columns.map((col) => (
                              <td key={col}>
                                {typeof row.data[col] === "object"
                                  ? JSON.stringify(row.data[col])
                                  : String(row.data[col] ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </dd>
            </div>

            <div className="payload-operation-form-actions">
              <a
                href={`/app/datasets/${selectedDataset.id}`}
                target="_parent"
                className="payload-button"
              >
                <Eye size={16} /> Open in dashboard
              </a>
              <button
                type="button"
                className="is-danger"
                onClick={() => handleDelete(selectedDataset.id, selectedDataset.name)}
              >
                <Trash2 size={16} /> Delete dataset
              </button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  )
}

// ─── DATASET UPLOAD VIEW ──────────────────────────────────────────────────────

export function PayloadDatasetUploadView() {
  const { user } = useAuth<CmsAdminUser>()
  if (user?.role !== "superadmin") return <PayloadOperatorAccessDenied />
  return <PayloadDatasetUploadWorkspace />
}

function PayloadDatasetUploadWorkspace() {
  const [users, setUsers] = useState<DashboardUser[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void fetch(`${API_ROOT}/businesses`, { credentials: "include", cache: "no-store" })
      .then((response) => readResponse<{ users: DashboardUser[] }>(response))
      .then((data) => setUsers(data.users))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load dashboard users."))
  }, [])

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setIsUploading(true)
    setError("")
    setMessage("")
    try {
      const response = await fetch(`${API_ROOT}/datasets`, {
        method: "POST",
        credentials: "include",
        body: new FormData(form),
      })
      const data = await readResponse<{
        dataset: { name: string; rowCount: number; columnCount: number }
      }>(response)
      setMessage(
        `${data.dataset.name} uploaded with ${data.dataset.rowCount} rows and ${data.dataset.columnCount} columns.`,
      )
      form.reset()
      if (fileRef.current) fileRef.current.value = ""
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not upload the dataset.")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <main className="payload-admin-operation-view">
      <OperationHeader
        eyebrow="Product operations"
        title="Dataset upload"
        description="Upload a CSV into the selected dashboard account using the production dataset schema."
      />
      <StatusMessage error={error} message={message} />

      <section className="payload-operation-card">
        <form
          className="payload-operation-form"
          onSubmit={upload}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false) }}
        >
          <label className="is-wide">
            Dashboard owner
            <select name="userId" required defaultValue="">
              <option value="">Select an owner</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email || user.name || user.id}
                </option>
              ))}
            </select>
          </label>
          <label className={`is-wide payload-upload-zone${dragOver ? " is-dragover" : ""}`}>
            <span className="payload-upload-icon">
              <Upload size={32} />
            </span>
            <span className="payload-upload-text">
              Click to choose a CSV file or drag and drop
            </span>
            <span className="payload-upload-hint">CSV files up to 50MB</span>
            <input
              ref={fileRef}
              name="file"
              type="file"
              accept=".csv,text/csv"
              required
            />
          </label>
          <div className="payload-operation-form-actions">
            <button type="submit" disabled={isUploading}>
              {isUploading ? "Uploading..." : "Upload dataset"}
            </button>
            {message && (
              <a href="/admin/datasets" className="payload-button is-secondary">
                View all datasets
              </a>
            )}
          </div>
        </form>
      </section>
    </main>
  )
}

// ─── AI ACTIONS ───────────────────────────────────────────────────────────────

export function PayloadAiActions() {
  const { user } = useAuth<CmsAdminUser>()
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [hybridOpen, setHybridOpen] = useState(false)
  if (user?.role !== "superadmin") return null

  return (
    <div className="payload-ai-actions">
      <button type="button" className="payload-ai-btn" onClick={() => setAssistantOpen(true)}>
        AI Assistant
      </button>
      <button type="button" className="payload-ai-btn is-hybrid" onClick={() => setHybridOpen(true)}>
        Hybrid AI
      </button>

      {assistantOpen && (
        <div className="payload-modal-overlay" onClick={() => setAssistantOpen(false)}>
          <div className="payload-ai-modal" onClick={(e) => e.stopPropagation()}>
            <div className="payload-ai-modal-header">
              <h2>Dataset AI Assistant</h2>
              <p>Ask questions about your datasets using AI-powered analysis.</p>
            </div>
            <div className="payload-ai-modal-body">
              <p>The assistant uses the dashboard user's dataset context for analysis.
              Conversation traces are logged for quality monitoring.</p>
              <div className="payload-ai-modal-features">
                <div className="payload-ai-feature">
                  <strong>Smart Analysis</strong>
                  <span>Ask natural questions about trends, KPIs, and anomalies</span>
                </div>
                <div className="payload-ai-feature">
                  <strong>Visual Explanations</strong>
                  <span>Get charts and data tables alongside plain-language answers</span>
                </div>
                <div className="payload-ai-feature">
                  <strong>History & Search</strong>
                  <span>Browse past conversations and search across all analyses</span>
                </div>
              </div>
            </div>
            <div className="payload-ai-modal-footer">
              <button
                type="button"
                className="is-secondary"
                onClick={() => setAssistantOpen(false)}
              >
                Cancel
              </button>
              <a href="/app/assistant" target="_parent" className="payload-button">
                Open AI Assistant
              </a>
            </div>
          </div>
        </div>
      )}

      {hybridOpen && (
        <div className="payload-modal-overlay" onClick={() => setHybridOpen(false)}>
          <div className="payload-ai-modal" onClick={(e) => e.stopPropagation()}>
            <div className="payload-ai-modal-header">
              <h2>Hybrid AI</h2>
              <p>Run AI models locally for faster, private analysis.</p>
            </div>
            <div className="payload-ai-modal-body">
              <p>Hybrid AI runs language models on your own machine.
              Your data stays local — no cloud API calls needed.</p>
              <div className="payload-ai-modal-features">
                <div className="payload-ai-feature">
                  <strong>Lite Tier</strong>
                  <span>llama3.2:3b model for quick queries (~Pro plan)</span>
                </div>
                <div className="payload-ai-feature">
                  <strong>MEGA Tier</strong>
                  <span>llama3:8b model for deep analysis (~Business plan)</span>
                </div>
                <div className="payload-ai-feature">
                  <strong>Private & Fast</strong>
                  <span>No data leaves your machine once the model is loaded</span>
                </div>
              </div>
            </div>
            <div className="payload-ai-modal-footer">
              <button
                type="button"
                className="is-secondary"
                onClick={() => setHybridOpen(false)}
              >
                Cancel
              </button>
              <a href="/app/settings/billing" target="_parent" className="payload-button">
                Configure Hybrid AI
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ACCESS DENIED ────────────────────────────────────────────────────────────

function PayloadOperatorAccessDenied() {
  return (
    <main className="payload-admin-operation-view">
      <OperationHeader
        eyebrow="Product operations"
        title="Superadmin access required"
        description="Sign in with a Payload superadmin account to manage product operations."
      />
      <div className="payload-operation-notice is-error" role="alert">
        This CMS account cannot access customer or dataset operations.
      </div>
    </main>
  )
}
