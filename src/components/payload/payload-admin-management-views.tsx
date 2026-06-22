"use client"

import { Modal } from "@/components/ui/modal"
import { useAuth } from "@payloadcms/ui"
import { BarChart3, Layers, Percent, Users } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

type CmsAdminUser = { role?: "base" | "superadmin" }

type CustomerRow = {
  id: string
  name: string | null
  email: string | null
  plan: string
  planStatus: string
  signupDate: string | null
  lastLogin: string | null
  referralSource: string | null
  loginCount: number
  datasets: number
}

type DiscountRule = {
  id: string
  type: "free" | "percentage" | "referral" | "stacking"
  name: string
  code: string
  percent?: number
  description: string
  enabled: boolean
  planTarget?: "all" | "free" | "pro" | "business"
}

type CustomerLevel = {
  id: string
  name: string
  minInteractions: number
  minPageVisits: number
  minUploads: number
  minCreditsUsed: number
  minLogins: number
  creditReward: number
}

type OnboardingStatus = {
  completionPercent: number
  steps: Array<{
    id: string
    title: string
    description: string
    href: string
    complete: boolean
    group: string
    section: string
  }>
  completedCount: number
  totalCount: number
}

const LEVEL_API = "/api/admin/levels"
const DISCOUNT_API = "/api/admin/discounts"
const CUSTOMER_API = "/api/admin/customers"
const ONBOARDING_API = "/api/onboarding"

async function readResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(body.error || "The admin request failed.")
  return body
}

function OperationHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
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
  return <div className={`payload-operation-notice${error ? " is-error" : ""}`} role="status">{error || message}</div>
}

function PayloadOperatorAccessDenied() {
  return (
    <main className="payload-admin-operation-view">
      <div className="payload-operation-card" style={{ padding: "2rem", textAlign: "center" }}>
        <p>You do not have permission to access this area.</p>
      </div>
    </main>
  )
}

export function PayloadAdminManagementNav() {
  const { user } = useAuth<CmsAdminUser>()
  if (user?.role !== "superadmin") return null

  return (
    <nav className="payload-operation-nav" aria-label="Admin management">
      <span>Admin management</span>
      <a href="/admin/customers"><Users className="payload-nav-icon" /> Customers</a>
      <a href="/admin/discounts"><Percent className="payload-nav-icon" /> Discount rules</a>
      <a href="/admin/levels"><Layers className="payload-nav-icon" /> Customer levels</a>
      <a href="/admin/progress"><BarChart3 className="payload-nav-icon" /> Onboarding progress</a>
    </nav>
  )
}

export function PayloadCustomersView() {
  const { user } = useAuth<CmsAdminUser>()
  if (user?.role !== "superadmin") return <PayloadOperatorAccessDenied />
  return <PayloadCustomersWorkspace />
}

function PayloadCustomersWorkspace() {
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [selected, setSelected] = useState<CustomerRow | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [formName, setFormName] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formPlan, setFormPlan] = useState("free")

  const load = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const data = await readResponse<{ customers: CustomerRow[] }>(await fetch(CUSTOMER_API, { credentials: "include", cache: "no-store" }))
      setCustomers(data.customers)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load customers.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function openEdit(c: CustomerRow) {
    setSelected(c)
    setFormName(c.name || "")
    setFormEmail(c.email || "")
    setFormPlan(c.plan)
    setIsOpen(true)
    setError("")
    setMessage("")
  }

  function openCreate() {
    setSelected(null)
    setFormName("")
    setFormEmail("")
    setFormPlan("free")
    setIsOpen(true)
    setError("")
    setMessage("")
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this customer permanently?")) return
    setError("")
    setMessage("")
    try {
      await fetch(CUSTOMER_API, { method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
      setMessage("Customer deleted.")
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete customer.")
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setIsSaving(true)
    setError("")
    setMessage("")
    try {
      if (selected) {
        await fetch(CUSTOMER_API, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, fullName: formName, email: formEmail, subscriptionTier: formPlan }) })
        setMessage("Customer updated.")
      } else {
        await fetch(CUSTOMER_API, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: formEmail, fullName: formName, subscriptionTier: formPlan }) })
        setMessage("Customer created.")
      }
      setIsOpen(false)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save customer.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="payload-admin-operation-view">
      <OperationHeader eyebrow="Admin management" title="Customers" description="Manage dashboard user accounts, plans, and access." />
      <StatusMessage error={error} message={message} />
      <div className="payload-operation-toolbar">
        <p>{customers.length} customer{customers.length === 1 ? "" : "s"}</p>
        <button type="button" onClick={openCreate}>Add customer</button>
      </div>
      <div className="payload-operation-table-wrap">
        <table className="payload-operation-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Email</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Signup</th>
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6}>Loading customers...</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={6}>No customers found.</td></tr>
            ) : customers.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.name || "—"}</strong></td>
                <td>{c.email || "—"}</td>
                <td><span className="payload-operation-status">{c.plan}</span></td>
                <td>{c.planStatus}</td>
                <td>{c.signupDate ? new Date(c.signupDate).toLocaleDateString() : "—"}</td>
                <td>
                  <button type="button" className="payload-operation-link" onClick={() => openEdit(c)}>Edit</button>
                  <button type="button" className="payload-operation-link" style={{ marginLeft: "0.5rem", color: "var(--theme-error-500)" }} onClick={() => handleDelete(c.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={isOpen} onOpenChange={setIsOpen} title={selected ? "Edit customer" : "Add customer"} description="Manage the dashboard user account details.">
        <form className="payload-operation-form" onSubmit={save}>
          <label>
            Full name
            <input name="fullName" value={formName} onChange={(e) => setFormName(e.target.value)} required />
          </label>
          <label>
            Email
            <input name="email" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} required />
          </label>
          <label>
            Plan
            <select name="subscriptionTier" value={formPlan} onChange={(e) => setFormPlan(e.target.value)}>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="business">Business</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </label>
          <StatusMessage error={error} message="" />
          <div className="payload-operation-form-actions">
            <button type="button" className="is-secondary" onClick={() => setIsOpen(false)}>Cancel</button>
            <button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save customer"}</button>
          </div>
        </form>
      </Modal>
    </main>
  )
}

export function PayloadDiscountsView() {
  const { user } = useAuth<CmsAdminUser>()
  if (user?.role !== "superadmin") return <PayloadOperatorAccessDenied />
  return <PayloadDiscountsWorkspace />
}

function PayloadDiscountsWorkspace() {
  const [rules, setRules] = useState<DiscountRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [editRule, setEditRule] = useState<DiscountRule | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [formName, setFormName] = useState("")
  const [formType, setFormType] = useState<DiscountRule["type"]>("percentage")
  const [formCode, setFormCode] = useState("")
  const [formPercent, setFormPercent] = useState(10)
  const [formDescription, setFormDescription] = useState("")
  const [formEnabled, setFormEnabled] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const data = await readResponse<{ discountRules: DiscountRule[] }>(await fetch(DISCOUNT_API, { credentials: "include", cache: "no-store" }))
      setRules(data.discountRules || [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load discount rules.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function openEdit(rule: DiscountRule) {
    setEditRule(rule)
    setFormName(rule.name)
    setFormType(rule.type)
    setFormCode(rule.code)
    setFormPercent(rule.percent || 0)
    setFormDescription(rule.description)
    setFormEnabled(rule.enabled)
    setIsOpen(true)
    setError("")
    setMessage("")
  }

  function openCreate() {
    setEditRule(null)
    setFormName("")
    setFormType("percentage")
    setFormCode("")
    setFormPercent(10)
    setFormDescription("")
    setFormEnabled(true)
    setIsOpen(true)
    setError("")
    setMessage("")
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setIsSaving(true)
    setError("")
    setMessage("")
    try {
      const updatedRule: DiscountRule = { id: editRule?.id || String(Date.now()), name: formName, type: formType, code: formCode, percent: formPercent, description: formDescription, enabled: formEnabled }
      const updated = editRule ? rules.map((r) => r.id === editRule.id ? updatedRule : r) : [...rules, updatedRule]
      await fetch(DISCOUNT_API, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rules: updated }) })
      setMessage(editRule ? "Discount rule updated." : "Discount rule created.")
      setIsOpen(false)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save discount rule.")
    } finally {
      setIsSaving(false)
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this discount rule?")) return
    setError("")
    setMessage("")
    try {
      const updated = rules.filter((r) => r.id !== id)
      await fetch(DISCOUNT_API, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rules: updated }) })
      setMessage("Discount rule removed.")
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove discount rule.")
    }
  }

  return (
    <main className="payload-admin-operation-view">
      <OperationHeader eyebrow="Admin management" title="Discount rules" description="Configure discount codes, percentages, and referral rewards." />
      <StatusMessage error={error} message={message} />
      <div className="payload-operation-toolbar">
        <p>{rules.length} rule{rules.length === 1 ? "" : "s"}</p>
        <button type="button" onClick={openCreate}>Add rule</button>
      </div>
      <div className="payload-operation-table-wrap">
        <table className="payload-operation-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Code</th>
              <th>Percent</th>
              <th>Status</th>
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6}>Loading discount rules...</td></tr>
            ) : rules.length === 0 ? (
              <tr><td colSpan={6}>No discount rules configured.</td></tr>
            ) : rules.map((rule) => (
              <tr key={rule.id}>
                <td><strong>{rule.name}</strong><small>{rule.description}</small></td>
                <td>{rule.type}</td>
                <td><code>{rule.code}</code></td>
                <td>{rule.percent != null ? `${rule.percent}%` : "—"}</td>
                <td><span className={`payload-operation-status${rule.enabled ? "" : ""}`} style={rule.enabled ? { background: "var(--theme-success-100)", color: "var(--theme-success-600)" } : {}}>{rule.enabled ? "Active" : "Disabled"}</span></td>
                <td>
                  <button type="button" className="payload-operation-link" onClick={() => openEdit(rule)}>Edit</button>
                  <button type="button" className="payload-operation-link" style={{ marginLeft: "0.5rem", color: "var(--theme-error-500)" }} onClick={() => remove(rule.id)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={isOpen} onOpenChange={setIsOpen} title={editRule ? "Edit discount rule" : "Add discount rule"} description="Configure the discount parameters.">
        <form className="payload-operation-form" onSubmit={save}>
          <label>
            Name
            <input name="name" value={formName} onChange={(e) => setFormName(e.target.value)} required />
          </label>
          <label>
            Type
            <select name="type" value={formType} onChange={(e) => setFormType(e.target.value as DiscountRule["type"])}>
              <option value="percentage">Percentage</option>
              <option value="free">Free</option>
              <option value="referral">Referral</option>
              <option value="stacking">Stacking</option>
            </select>
          </label>
          <label>
            Code
            <input name="code" value={formCode} onChange={(e) => setFormCode(e.target.value)} required />
          </label>
          <label>
            Percent
            <input name="percent" type="number" min={0} max={100} value={formPercent} onChange={(e) => setFormPercent(Number(e.target.value))} />
          </label>
          <label className="is-wide">
            Description
            <textarea name="description" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} />
          </label>
          <label className="is-wide" style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
            <input name="enabled" type="checkbox" checked={formEnabled} onChange={(e) => setFormEnabled(e.target.checked)} style={{ width: "auto" }} />
            Active
          </label>
          <StatusMessage error={error} message="" />
          <div className="payload-operation-form-actions">
            <button type="button" className="is-secondary" onClick={() => setIsOpen(false)}>Cancel</button>
            <button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save rule"}</button>
          </div>
        </form>
      </Modal>
    </main>
  )
}

export function PayloadLevelsView() {
  const { user } = useAuth<CmsAdminUser>()
  if (user?.role !== "superadmin") return <PayloadOperatorAccessDenied />
  return <PayloadLevelsWorkspace />
}

function PayloadLevelsWorkspace() {
  const [levels, setLevels] = useState<CustomerLevel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [editLevel, setEditLevel] = useState<CustomerLevel | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [formName, setFormName] = useState("")
  const [formMinInteractions, setFormMinInteractions] = useState(0)
  const [formMinPageVisits, setFormMinPageVisits] = useState(0)
  const [formMinUploads, setFormMinUploads] = useState(0)
  const [formMinCreditsUsed, setFormMinCreditsUsed] = useState(0)
  const [formMinLogins, setFormMinLogins] = useState(1)
  const [formCreditReward, setFormCreditReward] = useState(0)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const data = await readResponse<{ levels: CustomerLevel[] }>(await fetch(LEVEL_API, { credentials: "include", cache: "no-store" }))
      setLevels(data.levels || [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load levels.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function openEdit(level: CustomerLevel) {
    setEditLevel(level)
    setFormName(level.name)
    setFormMinInteractions(level.minInteractions)
    setFormMinPageVisits(level.minPageVisits)
    setFormMinUploads(level.minUploads)
    setFormMinCreditsUsed(level.minCreditsUsed)
    setFormMinLogins(level.minLogins)
    setFormCreditReward(level.creditReward)
    setIsOpen(true)
    setError("")
    setMessage("")
  }

  function openCreate() {
    setEditLevel(null)
    setFormName("")
    setFormMinInteractions(0)
    setFormMinPageVisits(0)
    setFormMinUploads(0)
    setFormMinCreditsUsed(0)
    setFormMinLogins(1)
    setFormCreditReward(0)
    setIsOpen(true)
    setError("")
    setMessage("")
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setIsSaving(true)
    setError("")
    setMessage("")
    try {
      const updatedLevel: CustomerLevel = {
        id: editLevel?.id || String(Date.now()),
        name: formName,
        minInteractions: formMinInteractions,
        minPageVisits: formMinPageVisits,
        minUploads: formMinUploads,
        minCreditsUsed: formMinCreditsUsed,
        minLogins: formMinLogins,
        creditReward: formCreditReward,
      }
      const updated = editLevel ? levels.map((l) => l.id === editLevel.id ? updatedLevel : l) : [...levels, updatedLevel]
      await fetch(LEVEL_API, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ levels: updated }) })
      setMessage(editLevel ? "Level updated." : "Level created.")
      setIsOpen(false)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save level.")
    } finally {
      setIsSaving(false)
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this level?")) return
    setError("")
    setMessage("")
    try {
      const updated = levels.filter((l) => l.id !== id)
      await fetch(LEVEL_API, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ levels: updated }) })
      setMessage("Level removed.")
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove level.")
    }
  }

  return (
    <main className="payload-admin-operation-view">
      <OperationHeader eyebrow="Admin management" title="Customer levels" description="Configure experience tiers with thresholds and credit rewards." />
      <StatusMessage error={error} message={message} />
      <div className="payload-operation-toolbar">
        <p>{levels.length} level{levels.length === 1 ? "" : "s"}</p>
        <button type="button" onClick={openCreate}>Add level</button>
      </div>
      <div className="payload-operation-table-wrap">
        <table className="payload-operation-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Interactions</th>
              <th>Visits</th>
              <th>Uploads</th>
              <th>Credits</th>
              <th>Logins</th>
              <th>Reward</th>
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8}>Loading levels...</td></tr>
            ) : levels.length === 0 ? (
              <tr><td colSpan={8}>No levels configured.</td></tr>
            ) : levels.map((l) => (
              <tr key={l.id}>
                <td><strong>{l.name}</strong></td>
                <td>{l.minInteractions}</td>
                <td>{l.minPageVisits}</td>
                <td>{l.minUploads}</td>
                <td>{l.minCreditsUsed}</td>
                <td>{l.minLogins}</td>
                <td>{l.creditReward}</td>
                <td>
                  <button type="button" className="payload-operation-link" onClick={() => openEdit(l)}>Edit</button>
                  <button type="button" className="payload-operation-link" style={{ marginLeft: "0.5rem", color: "var(--theme-error-500)" }} onClick={() => remove(l.id)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={isOpen} onOpenChange={setIsOpen} title={editLevel ? "Edit level" : "Add level"} description="Set the threshold requirements and credit reward for this tier.">
        <form className="payload-operation-form" onSubmit={save}>
          <label>
            Name
            <input name="name" value={formName} onChange={(e) => setFormName(e.target.value)} required />
          </label>
          <label>
            Min Interactions
            <input name="minInteractions" type="number" min={0} value={formMinInteractions} onChange={(e) => setFormMinInteractions(Number(e.target.value))} />
          </label>
          <label>
            Min Page Visits
            <input name="minPageVisits" type="number" min={0} value={formMinPageVisits} onChange={(e) => setFormMinPageVisits(Number(e.target.value))} />
          </label>
          <label>
            Min Uploads
            <input name="minUploads" type="number" min={0} value={formMinUploads} onChange={(e) => setFormMinUploads(Number(e.target.value))} />
          </label>
          <label>
            Min Credits Used
            <input name="minCreditsUsed" type="number" min={0} value={formMinCreditsUsed} onChange={(e) => setFormMinCreditsUsed(Number(e.target.value))} />
          </label>
          <label>
            Min Logins
            <input name="minLogins" type="number" min={1} value={formMinLogins} onChange={(e) => setFormMinLogins(Number(e.target.value))} />
          </label>
          <label>
            Credit Reward
            <input name="creditReward" type="number" min={0} value={formCreditReward} onChange={(e) => setFormCreditReward(Number(e.target.value))} />
          </label>
          <StatusMessage error={error} message="" />
          <div className="payload-operation-form-actions">
            <button type="button" className="is-secondary" onClick={() => setIsOpen(false)}>Cancel</button>
            <button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save level"}</button>
          </div>
        </form>
      </Modal>
    </main>
  )
}

export function PayloadProgressView() {
  const { user } = useAuth<CmsAdminUser>()
  if (user?.role !== "superadmin") return <PayloadOperatorAccessDenied />
  return <PayloadProgressWorkspace />
}

function PayloadProgressWorkspace() {
  const [statuses, setStatuses] = useState<Record<string, OnboardingStatus>>({})
  const [users, setUsers] = useState<Array<{ id: string; name: string | null; email: string | null }>>([])
  const [selectedUser, setSelectedUser] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const loadUsers = useCallback(async () => {
    try {
      const data = await readResponse<{ customers: CustomerRow[] }>(await fetch(CUSTOMER_API, { credentials: "include", cache: "no-store" }))
      setUsers(data.customers.map((c) => ({ id: c.id, name: c.name, email: c.email })))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load users.")
    }
  }, [])

  const loadProgress = useCallback(async (userId: string) => {
    if (!userId) return
    setError("")
    try {
      const data = await readResponse<OnboardingStatus>(await fetch(`${ONBOARDING_API}?userId=${userId}`, { credentials: "include", cache: "no-store" }))
      setStatuses((prev) => ({ ...prev, [userId]: data }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load onboarding progress.")
    }
  }, [])

  useEffect(() => {
    setIsLoading(true)
    Promise.all([loadUsers()]).finally(() => setIsLoading(false))
  }, [loadUsers])

  useEffect(() => {
    if (selectedUser) void loadProgress(selectedUser)
  }, [selectedUser, loadProgress])

  const current = selectedUser ? statuses[selectedUser] : null

  return (
    <main className="payload-admin-operation-view">
      <OperationHeader eyebrow="Admin management" title="Onboarding progress" description="Track user onboarding completion across all steps." />
      <StatusMessage error={error} message="" />
      <div className="payload-operation-toolbar" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.75rem" }}>
        <label style={{ display: "grid", gap: "0.35rem", fontSize: "0.75rem", fontWeight: 700 }}>
          Select user
          <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} style={{ minHeight: "2.5rem", padding: "0.5rem", borderRadius: "0.35rem", border: "1px solid var(--theme-elevation-250)", background: "var(--theme-input-bg)", color: "var(--theme-text)", fontSize: "0.875rem" }}>
            <option value="">— Choose a user —</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.email || u.name || u.id}</option>)}
          </select>
        </label>
      </div>
      {isLoading && <p>Loading...</p>}
      {current && (
        <div className="payload-operation-card" style={{ marginTop: "1rem", padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <strong style={{ fontSize: "1.125rem" }}>Onboarding progress</strong>
            <span className="payload-operation-status" style={{
              background: current.completionPercent >= 100 ? "var(--theme-success-100)" : "var(--theme-elevation-100)",
              color: current.completionPercent >= 100 ? "var(--theme-success-600)" : "var(--theme-elevation-600)",
              padding: "0.25rem 0.75rem",
            }}>
              {current.completedCount}/{current.totalCount} steps
            </span>
          </div>
          <div style={{ height: "0.5rem", borderRadius: "999px", background: "var(--theme-elevation-100)", overflow: "hidden", marginBottom: "1.25rem" }}>
            <div style={{ height: "100%", borderRadius: "999px", background: "var(--theme-success-500)", width: `${current.completionPercent}%`, transition: "width 0.3s" }} />
          </div>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {current.steps.map((step) => (
              <div key={step.id} style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                padding: "0.6rem 0.75rem", borderRadius: "0.35rem",
                background: step.complete ? "var(--theme-success-50)" : "var(--theme-elevation-50)",
                opacity: step.complete ? 1 : 0.7,
              }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: "1.5rem", height: "1.5rem", borderRadius: "999px",
                  background: step.complete ? "var(--theme-success-500)" : "var(--theme-elevation-200)",
                  color: step.complete ? "white" : "var(--theme-elevation-500)",
                  fontSize: "0.7rem", fontWeight: 700, flexShrink: 0,
                }}>
                  {step.complete ? "✓" : String(current.steps.indexOf(step) + 1)}
                </span>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: "0.8125rem", display: "block" }}>{step.title}</strong>
                  <span style={{ fontSize: "0.6875rem", color: "var(--theme-elevation-500)" }}>{step.group} · {step.section}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {!isLoading && selectedUser && !current && <p style={{ marginTop: "1rem", color: "var(--theme-elevation-500)" }}>No onboarding data available for this user.</p>}
    </main>
  )
}
