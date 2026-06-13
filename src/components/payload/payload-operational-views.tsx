"use client"

import HybridAiButton from "@/components/ui/hybrid-ai-button"
import { Modal } from "@/components/ui/modal"
import { useAuth } from "@payloadcms/ui"
import { Building2, Ticket, Upload } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

const API_ROOT = "/api/payload/admin-operations"

type DashboardUser = {
  id: string
  email: string | null
  name: string | null
}

type CmsAdminUser = {
  role?: "base" | "superadmin"
}

type BusinessRow = {
  id: string
  userId: string
  ownerEmail: string
  name: string
  email: string | null
  industry: string | null
  address: string | null
  website: string | null
  description: string | null
  status: string
  isPrimary: boolean
  updatedAt: string
}

type TicketRow = {
  id: string
  userEmail: string
  subject: string
  message: string
  category: string
  priority: string
  status: string
  adminNote: string
  updatedAt: string
}

async function readResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) {
    throw new Error(body.error || "The admin request failed.")
  }
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
  const crumbs = [
    { href: "/admin", label: "Admin" },
    { href: null, label: eyebrow },
  ]

  return (
    <header className="payload-operation-header">
      <nav className="payload-breadcrumbs" aria-label="Breadcrumb">
        {crumbs.map((crumb, i) => (
          <span key={crumb.label}>
            {i > 0 && <span className="payload-breadcrumbs__sep">/</span>}
            {crumb.href
              ? <a href={crumb.href}>{crumb.label}</a>
              : <span className="payload-breadcrumbs__current">{crumb.label}</span>
            }
          </span>
        ))}
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

export function PayloadOperationsNav() {
  const { user } = useAuth<CmsAdminUser>()
  if (user?.role !== "superadmin") return null

  return (
    <nav className="payload-operation-nav" aria-label="Product operations">
      <span>Product operations</span>
      <a href="/admin/business-profiles"><Building2 className="payload-nav-icon" /> Business profiles</a>
      <a href="/admin/support-issues"><Ticket className="payload-nav-icon" /> Support issues</a>
      <a href="/admin/dataset-upload"><Upload className="payload-nav-icon" /> Dataset upload</a>
    </nav>
  )
}

export function PayloadBusinessProfilesView() {
  const { user } = useAuth<CmsAdminUser>()
  if (user?.role !== "superadmin") return <PayloadOperatorAccessDenied />
  return <PayloadBusinessProfilesWorkspace />
}

function PayloadBusinessProfilesWorkspace() {
  const [businesses, setBusinesses] = useState<BusinessRow[]>([])
  const [users, setUsers] = useState<DashboardUser[]>([])
  const [selected, setSelected] = useState<BusinessRow | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const load = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const response = await fetch(`${API_ROOT}/businesses`, { credentials: "include", cache: "no-store" })
      const data = await readResponse<{ businesses: BusinessRow[]; users: DashboardUser[] }>(response)
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

  function openCreate() {
    setSelected(null)
    setIsOpen(true)
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
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
      setMessage(selected ? "Business profile updated." : "Business profile created.")
      setIsOpen(false)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the business profile.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="payload-admin-operation-view">
      <OperationHeader
        eyebrow="Product operations"
        title="Business profiles"
        description="Create and update business profiles for the selected dashboard account."
      />
      <StatusMessage error={error} message={message} />
      <div className="payload-operation-toolbar">
        <p>{businesses.length} business profile{businesses.length === 1 ? "" : "s"}</p>
        <button type="button" onClick={openCreate}>Add business profile</button>
      </div>
      <div className="payload-operation-table-wrap">
        <table className="payload-operation-table">
          <thead>
            <tr>
              <th>Business</th>
              <th>Owner</th>
              <th>Industry</th>
              <th>Status</th>
              <th>Updated</th>
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6}>Loading business profiles...</td></tr>
            ) : businesses.length === 0 ? (
              <tr><td colSpan={6}>No business profiles are available.</td></tr>
            ) : businesses.map((business) => (
              <tr key={business.id}>
                <td><strong>{business.name}</strong><small>{business.email || "No business email"}</small></td>
                <td>{business.ownerEmail}</td>
                <td>{business.industry || "Not set"}</td>
                <td><span className="payload-operation-status">{business.status}</span></td>
                <td>{new Date(business.updatedAt).toLocaleDateString()}</td>
                <td>
                  <button type="button" className="payload-operation-link" onClick={() => {
                    setSelected(business)
                    setIsOpen(true)
                  }}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal
        open={isOpen}
        onOpenChange={setIsOpen}
        title={selected ? "Edit business profile" : "Add business profile"}
        description="Changes apply to the selected dashboard user's business data."
      >
        <form className="payload-operation-form" onSubmit={save}>
          <input type="hidden" name="id" value={selected?.id || ""} />
          <label>
            Dashboard owner
            <select name="userId" required defaultValue={selected?.userId || ""}>
              <option value="">Select an owner</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.email || user.name || user.id}</option>
              ))}
            </select>
          </label>
          <label>Business name<input name="name" required defaultValue={selected?.name || ""} /></label>
          <label>Business email<input name="email" type="email" defaultValue={selected?.email || ""} /></label>
          <label>Industry<input name="industry" defaultValue={selected?.industry || ""} /></label>
          <label>Location<input name="address" defaultValue={selected?.address || ""} /></label>
          <label>Website<input name="website" type="url" defaultValue={selected?.website || ""} /></label>
          <label>
            Status
            <select name="status" defaultValue={selected?.status || "draft"}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="is-wide">Description<textarea name="description" rows={5} defaultValue={selected?.description || ""} /></label>
          <StatusMessage error={error} message="" />
          <div className="payload-operation-form-actions">
            <button type="button" className="is-secondary" onClick={() => setIsOpen(false)}>Cancel</button>
            <button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save business profile"}</button>
          </div>
        </form>
      </Modal>
    </main>
  )
}

export function PayloadSupportIssuesView() {
  const { user } = useAuth<CmsAdminUser>()
  if (user?.role !== "superadmin") return <PayloadOperatorAccessDenied />
  return <PayloadSupportIssuesWorkspace />
}

function PayloadSupportIssuesWorkspace() {
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [selected, setSelected] = useState<TicketRow | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const totals = useMemo(() => ({
    open: tickets.filter((ticket) => ticket.status === "open").length,
    urgent: tickets.filter((ticket) => ticket.priority === "urgent" && ticket.status !== "resolved").length,
  }), [tickets])

  const load = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const response = await fetch(`${API_ROOT}/issues`, { credentials: "include", cache: "no-store" })
      const data = await readResponse<{ tickets: TicketRow[] }>(response)
      setTickets(data.tickets)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load support issues.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    setIsSaving(true)
    setError("")
    const formData = new FormData(event.currentTarget)
    try {
      const response = await fetch(`${API_ROOT}/issues`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, ...Object.fromEntries(formData) }),
      })
      await readResponse(response)
      setSelected(null)
      setMessage("Support issue updated.")
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the support issue.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="payload-admin-operation-view">
      <OperationHeader
        eyebrow="Product operations"
        title="Support issues"
        description="Review customer issues, assign operator notes, and update resolution status."
      />
      <StatusMessage error={error} message={message} />
      <div className="payload-operation-summary">
        <div><strong>{tickets.length}</strong><span>Total issues</span></div>
        <div><strong>{totals.open}</strong><span>Open</span></div>
        <div><strong>{totals.urgent}</strong><span>Urgent</span></div>
      </div>
      <div className="payload-operation-table-wrap">
        <table className="payload-operation-table">
          <thead><tr><th>Issue</th><th>Customer</th><th>Priority</th><th>Status</th><th>Updated</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6}>Loading support issues...</td></tr>
            ) : tickets.length === 0 ? (
              <tr><td colSpan={6}>No support issues are available.</td></tr>
            ) : tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td><strong>{ticket.subject}</strong><small>{ticket.category}: {ticket.message}</small></td>
                <td>{ticket.userEmail}</td>
                <td>{ticket.priority}</td>
                <td><span className="payload-operation-status">{ticket.status.replace("_", " ")}</span></td>
                <td>{new Date(ticket.updatedAt).toLocaleDateString()}</td>
                <td><button type="button" className="payload-operation-link" onClick={() => setSelected(ticket)}>Review</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.subject || "Support issue"}
        description={selected ? `${selected.userEmail} · ${selected.category}` : undefined}
      >
        {selected && (
          <form className="payload-operation-form" onSubmit={save}>
            <div className="payload-operation-message is-wide">{selected.message}</div>
            <label>
              Status
              <select name="status" defaultValue={selected.status}>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </label>
            <label className="is-wide">Operator note<textarea name="adminNote" rows={6} defaultValue={selected.adminNote} /></label>
            <StatusMessage error={error} message="" />
            <div className="payload-operation-form-actions">
              <button type="button" className="is-secondary" onClick={() => setSelected(null)}>Cancel</button>
              <button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Update issue"}</button>
            </div>
          </form>
        )}
      </Modal>
    </main>
  )
}

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
      const data = await readResponse<{ dataset: { name: string; rowCount: number; columnCount: number } }>(response)
      setMessage(`${data.dataset.name} uploaded with ${data.dataset.rowCount} rows and ${data.dataset.columnCount} columns.`)
      form.reset()
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
        <form className="payload-operation-form" onSubmit={upload}>
          <label className="is-wide">
            Dashboard owner
            <select name="userId" required defaultValue="">
              <option value="">Select an owner</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.email || user.name || user.id}</option>
              ))}
            </select>
          </label>
          <label className="is-wide">
            CSV file
            <input name="file" type="file" accept=".csv,text/csv" required />
            <small>CSV files up to 50MB. Numeric, text, date, and mixed columns use the canonical parser.</small>
          </label>
          <div className="payload-operation-form-actions">
            <button type="submit" disabled={isUploading}>{isUploading ? "Uploading..." : "Upload dataset"}</button>
          </div>
        </form>
      </section>
    </main>
  )
}

export function PayloadAiActions() {
  const { user } = useAuth<CmsAdminUser>()
  const [assistantOpen, setAssistantOpen] = useState(false)
  if (user?.role !== "superadmin") return null

  return (
    <div className="payload-ai-actions">
      <button type="button" onClick={() => setAssistantOpen(true)}>AI Assistant</button>
      <HybridAiButton subscriptionTier="superadmin" mode="link" />
      <Modal
        open={assistantOpen}
        onOpenChange={setAssistantOpen}
        title="Dataset AI Assistant"
        description="Open the dashboard workspace that uses the signed-in user's dataset context."
      >
        <div className="payload-ai-modal">
          <p>The assistant remains attached to dashboard user sessions so dataset isolation and conversation traces stay intact.</p>
          <a href="/app/assistant" target="_parent">Open AI Assistant</a>
        </div>
      </Modal>
    </div>
  )
}

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
