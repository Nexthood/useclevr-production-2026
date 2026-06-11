"use client"

import { AppPageHeader } from "@/components/layout/app-page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Save, Settings } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

type EditType = "customer" | "level" | "discount"

type CustomerForm = {
  id: string
  name: string
  email: string
  plan: string
  planStatus: string
  businessName: string
}

type LevelForm = {
  id: string
  name: string
  minInteractions: number
  minPageVisits: number
  minUploads: number
  minCreditsUsed: number
  minLogins: number
  creditReward: number
}

type DiscountForm = {
  id: string
  type: "free" | "percentage" | "referral" | "stacking"
  name: string
  code: string
  percent: number
  description: string
  enabled: boolean
  planTarget: "all" | "free" | "pro" | "business"
}

const levelFields = [
  { key: "minInteractions", label: "Interactions", min: 0 },
  { key: "minPageVisits", label: "Visits", min: 0 },
  { key: "minUploads", label: "Uploads", min: 0 },
  { key: "minCreditsUsed", label: "Credits used", min: 0 },
  { key: "minLogins", label: "Logins", min: 1 },
  { key: "creditReward", label: "Credit reward", min: 0 },
] as const

const ruleTypes: DiscountForm["type"][] = ["free", "percentage", "referral", "stacking"]

export default function AdminEditPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const type = searchParams.get("type") as EditType | null
  const id = searchParams.get("id")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customer, setCustomer] = useState<CustomerForm | null>(null)
  const [level, setLevel] = useState<LevelForm | null>(null)
  const [levels, setLevels] = useState<LevelForm[]>([])
  const [discount, setDiscount] = useState<DiscountForm | null>(null)
  const [discounts, setDiscounts] = useState<DiscountForm[]>([])

  const listHref = useMemo(() => {
    if (type === "customer") return "/app/admin/customers"
    if (type === "level") return "/app/admin/levels"
    if (type === "discount") return "/app/admin/discounts"
    return "/app/admin/customers"
  }, [type])

  const itemTitle = useMemo(() => {
    if (type === "customer" && customer) return customer.name
    if (type === "level" && level) return level.name
    if (type === "discount" && discount) return discount.name
    return id ?? "Loading..."
  }, [type, customer, level, discount, id])

  const pageTitle = useMemo(() => {
    if (type === "customer") return "Edit customer"
    if (type === "level") return "Edit customer level"
    if (type === "discount") return "Edit discount rule"
    return "Edit admin row"
  }, [type])

  const description = useMemo(() => {
    if (type === "customer") return "Update customer account details and subscription."
    if (type === "level") return "Update customer level requirements and rewards."
    if (type === "discount") return "Update discount rule settings and eligibility."
    return "Update admin row details."
  }, [type])

  useEffect(() => {
    const load = async () => {
      if (!type || !id || !["customer", "level", "discount"].includes(type)) {
        setError("Missing or invalid admin edit target.")
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)
      try {
        if (type === "customer") {
          const response = await fetch("/api/admin/customers", { cache: "no-store" })
          if (!response.ok) throw new Error("Failed to load customers")
          const data = await response.json()
          const row = data.customers?.find((item: CustomerForm) => item.id === id)
          if (!row) throw new Error("Customer not found")
          setCustomer({
            id: row.id,
            name: row.name || "",
            email: row.email || "",
            plan: row.plan || "free",
            planStatus: row.planStatus || "active",
            businessName: row.businessName || row.name || "",
          })
        }

        if (type === "level") {
          const response = await fetch("/api/admin/levels", { cache: "no-store" })
          if (!response.ok) throw new Error("Failed to load customer levels")
          const data = await response.json()
          const rows = data.levels || []
          const row = rows.find((item: LevelForm) => item.id === id)
          if (!row) throw new Error("Customer level not found")
          setLevels(rows)
          setLevel(row)
        }

        if (type === "discount") {
          const response = await fetch("/api/admin/discounts", { cache: "no-store" })
          if (!response.ok) throw new Error("Failed to load discount rules")
          const data = await response.json()
          const rows = data.discountRules || []
          const row = rows.find((item: DiscountForm) => item.id === id)
          if (!row) throw new Error("Discount rule not found")
          setDiscounts(rows)
          setDiscount(row)
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load row")
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [id, type])

  const save = async () => {
    setIsSaving(true)
    setError(null)
    try {
      if (type === "customer" && customer) {
        const response = await fetch("/api/admin/customers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: customer.id,
            updates: {
              fullName: customer.name,
              email: customer.email,
              subscriptionTier: customer.plan,
              stripeStatus: customer.planStatus,
              businessName: customer.businessName,
            },
          }),
        })
        if (!response.ok) throw new Error((await response.json()).error || "Save failed")
      }

      if (type === "level" && level) {
        const response = await fetch("/api/admin/levels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            levels: levels.map((item) => (item.id === level.id ? level : item)),
          }),
        })
        if (!response.ok) throw new Error("Save failed")
      }

      if (type === "discount" && discount) {
        const response = await fetch("/api/admin/discounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rules: discounts.map((item) => (item.id === discount.id ? discount : item)),
          }),
        })
        if (!response.ok) throw new Error("Save failed")
      }

      toast({
        title: "Row saved",
        description: "The admin row was updated.",
        variant: "default",
      })
      router.push(listHref)
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Save failed"
      setError(message)
      toast({
        title: "Save failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex-1 bg-background">
      <AppPageHeader
        title={pageTitle}
        description={description}
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: type === "customer" ? "Customers" : type === "level" ? "Customer Levels" : "Discount Rules", href: listHref },
          { label: itemTitle },
        ]}
        actions={
          <Link href={listHref}>
            <Button variant="outline" size="sm" className="gap-2 bg-transparent">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        }
        icon={Settings}
      />

      <main className="px-5 py-5">
        <Card className="mx-auto max-w-3xl p-5">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading row…</p>
          ) : error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : (
            <div className="space-y-5">
              {type === "customer" && customer && (
                <CustomerFields value={customer} onChange={setCustomer} />
              )}
              {type === "level" && level && <LevelFields value={level} onChange={setLevel} />}
              {type === "discount" && discount && (
                <DiscountFields value={discount} onChange={setDiscount} />
              )}

              <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center">
                <Button onClick={save} disabled={isSaving} className="gap-2">
                  <Save className="h-4 w-4" />
                  {isSaving ? "Saving…" : "Save row"}
                </Button>
                <Link href={listHref}>
                  <Button variant="outline" className="bg-transparent">
                    Cancel
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}

function CustomerFields({
  value,
  onChange,
}: {
  value: CustomerForm
  onChange: (value: CustomerForm) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField label="Name" value={value.name} onChange={(name) => onChange({ ...value, name })} />
      <TextField
        label="Email"
        type="email"
        value={value.email}
        onChange={(email) => onChange({ ...value, email })}
      />
      <SelectField
        label="Plan"
        value={value.plan}
        options={["free", "pro", "business"]}
        onChange={(plan) => onChange({ ...value, plan })}
      />
      <TextField
        label="Plan status"
        value={value.planStatus}
        onChange={(planStatus) => onChange({ ...value, planStatus })}
      />
      <div className="sm:col-span-2">
        <TextField
          label="Business name"
          value={value.businessName}
          onChange={(businessName) => onChange({ ...value, businessName })}
        />
      </div>
    </div>
  )
}

function LevelFields({
  value,
  onChange,
}: {
  value: LevelForm
  onChange: (value: LevelForm) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <TextField label="Level name" value={value.name} onChange={(name) => onChange({ ...value, name })} />
      </div>
      {levelFields.map((field) => (
        <NumberField
          key={field.key}
          label={field.label}
          min={field.min}
          value={value[field.key]}
          onChange={(nextValue) => onChange({ ...value, [field.key]: nextValue })}
        />
      ))}
    </div>
  )
}

function DiscountFields({
  value,
  onChange,
}: {
  value: DiscountForm
  onChange: (value: DiscountForm) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField label="Name" value={value.name} onChange={(name) => onChange({ ...value, name })} />
      <SelectField
        label="Type"
        value={value.type}
        options={ruleTypes}
        onChange={(type) => onChange({ ...value, type: type as DiscountForm["type"] })}
      />
      <TextField label="Code" value={value.code} onChange={(code) => onChange({ ...value, code })} />
      <NumberField
        label="Percent"
        min={0}
        max={100}
        value={value.percent}
        onChange={(percent) => onChange({ ...value, percent })}
      />
      <SelectField
        label="Plan Target"
        value={value.planTarget}
        options={["all", "free", "pro", "business"]}
        onChange={(planTarget) => onChange({ ...value, planTarget: planTarget as DiscountForm["planTarget"] })}
      />
      <SelectField
        label="Status"
        value={value.enabled ? "true" : "false"}
        options={["true", "false"]}
        onChange={(enabled) => onChange({ ...value, enabled: enabled === "true" })}
      />
      <div className="sm:col-span-2">
        <TextField
          label="Description"
          value={value.description}
          onChange={(description) => onChange({ ...value, description })}
        />
      </div>
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-")

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max?: number
  onChange: (value: number) => void
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-")

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Math.max(min, Number(event.target.value) || 0))}
      />
    </div>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-")

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}