"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Ban, Gift, Layers, Percent, Plus, Tag, Trash2 } from "lucide-react"
import { useState } from "react"

export type DiscountRule = {
  id: string
  type: "free" | "percentage" | "referral" | "stacking"
  name: string
  code: string
  percent?: number
  description: string
  enabled: boolean
}

const DEFAULT_RULES: DiscountRule[] = [
  { id: "1", type: "percentage", name: "Pro Annual Discount", code: "ANNUAL20", percent: 17, description: "17 % off when billing annually for Pro.", enabled: true },
  { id: "2", type: "referral", name: "Referral Reward", code: "REFERRAL", percent: 100, description: "Free month for each successful referral. Stacking with annual discount is allowed.", enabled: true },
]

const typeIcon: Record<string, typeof Tag> = {
  free: Ban,
  percentage: Percent,
  referral: Gift,
  stacking: Layers,
}

const typeLabel: Record<string, string> = {
  free: "Free plan",
  percentage: "Percentage",
  referral: "Referral",
  stacking: "Stacking",
}

function DiscountCard({
  rule,
  onUpdate,
  onRemove,
}: {
  rule: DiscountRule
  onUpdate: (patch: Partial<DiscountRule>) => void
  onRemove: () => void
}) {
  const Icon = typeIcon[rule.type] || Tag
  return (
    <Card className="p-5 border-border bg-card">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{typeLabel[rule.type]}</p>
            <Input
              value={rule.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="h-7 text-sm font-semibold mt-0.5"
            />
          </div>
        </div>
        <button onClick={onRemove} className="rounded-full p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-600 transition-colors" aria-label="Remove">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${rule.id}-code`} className="text-xs">Discount code</Label>
          <Input id={`${rule.id}-code`} value={rule.code} onChange={(e) => onUpdate({ code: e.target.value })} className="h-8 text-sm font-mono" />
        </div>
        {(rule.type === "percentage" || rule.type === "referral") && (
          <div className="space-y-1">
            <Label htmlFor={`${rule.id}-percent`} className="text-xs">Discount %</Label>
            <Input id={`${rule.id}-percent`} type="number" min={0} max={100} value={rule.percent ?? 0} onChange={(e) => onUpdate({ percent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} className="h-8 text-sm" />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor={`${rule.id}-desc`} className="text-xs">Description</Label>
          <Input id={`${rule.id}-desc`} value={rule.description} onChange={(e) => onUpdate({ description: e.target.value })} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${rule.id}-enabled`} className="text-xs">Status</Label>
          <select
            id={`${rule.id}-enabled`}
            value={rule.enabled ? "true" : "false"}
            onChange={(e) => onUpdate({ enabled: e.target.value === "true" })}
            className="h-8 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="true">Active</option>
            <option value="false">Disabled</option>
          </select>
        </div>
      </div>
    </Card>
  )
}

export default function AdminDiscountsPage() {
  const [rules, setRules] = useState<DiscountRule[]>(DEFAULT_RULES)
  const [saved, setSaved] = useState<string | null>(null)

  const updateRule = (id: string, patch: Partial<DiscountRule>) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    setSaved(null)
  }

  const addRule = () => {
    setRules((prev) => [
      ...prev,
      { id: String(Date.now()), type: "percentage", name: "New Discount", code: "", percent: 10, description: "", enabled: true },
    ])
    setSaved(null)
  }

  const removeRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id))
    setSaved(null)
  }

  const save = async () => {
    try {
      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      })
      if (!res.ok) throw new Error("Save failed")
      setSaved("Discount rules saved.")
    } catch {
      setSaved("Save failed. Try again.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Discount Rules</h2>
          <p className="text-sm text-muted-foreground">Manage free, percentage, referral, and stacking discounts across checkout.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addRule} className="gap-1.5 bg-transparent">
            <Plus className="h-4 w-4" />
            Add rule
          </Button>
          <Button size="sm" onClick={save}>
            Save rules
          </Button>
        </div>
      </div>
      {saved && <p className="text-sm text-emerald-600 dark:text-emerald-400">{saved}</p>}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rules.map((rule) => (
          <DiscountCard key={rule.id} rule={rule} onUpdate={(patch) => updateRule(rule.id, patch)} onRemove={() => removeRule(rule.id)} />
        ))}
      </div>
    </div>
  )
}
