"use client"

import { AppPageHeader } from "@/components/layout/app-page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Plus, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useEffect, useState } from "react"

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
  { id: "2", type: "referral", name: "Referral Reward", code: "REFERRAL", percent: 100, description: "Free month for each successful referral.", enabled: true },
]

const ruleTypes: DiscountRule["type"][] = ["free", "percentage", "referral", "stacking"]

export default function AdminDiscountsPage() {
  const [rules, setRules] = useState<DiscountRule[]>(DEFAULT_RULES)
  const [saved, setSaved] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const loadRules = async () => {
      setIsLoading(true)
      try {
        const res = await fetch("/api/admin/discounts", { cache: "no-store" })
        if (!res.ok) throw new Error("Failed to load discount rules")
        const data = await res.json()
        if (Array.isArray(data?.discountRules) && data.discountRules.length > 0) setRules(data.discountRules)
        toast({
          title: "Discount rules loaded",
          description: "Discount rules have been successfully refreshed.",
          variant: "default",
        })
      } catch (err) {
        toast({
          title: "Error loading discount rules",
          description: err instanceof Error ? err.message : "Failed to load",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }
    loadRules()
  }, [toast])

  const updateRule = (id: string, patch: Partial<DiscountRule>) => {
    setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)))
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
    setRules((prev) => prev.filter((rule) => rule.id !== id))
    setSaved(null)
  }

  const save = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      })
      if (!res.ok) throw new Error("Save failed")
      setSaved("Discount rules saved.")
      toast({
        title: "Discount rules saved",
        description: "Your changes have been successfully saved.",
        variant: "default",
      })
    } catch {
      toast({
        title: "Error saving discount rules",
        description: "Save failed. Try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppPageHeader
        title="Discount Rules"
        description="Manage free, percentage, referral, and stacking discounts across checkout."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Discount Rules" },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addRule} className="gap-1.5 bg-transparent">
              <Plus className="h-4 w-4" />
              Add rule
            </Button>
            <Button size="sm" onClick={save} disabled={isLoading}>
              {isLoading ? "Saving…" : "Save"}
            </Button>
          </div>
        }
      />

      <main className="px-5 py-5">
        <Card className="overflow-hidden border-border bg-card">
          {saved && <p className="border-b border-border px-5 py-3 text-sm text-muted-foreground">{saved}</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-3 py-3 font-medium">Type</th>
                  <th className="px-3 py-3 font-medium">Code</th>
                  <th className="px-3 py-3 font-medium">Percent</th>
                  <th className="px-3 py-3 font-medium">Description</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Remove</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className="border-b border-border/60">
                    <td className="px-4 py-3">
                      <Input value={rule.name} onChange={(event) => updateRule(rule.id, { name: event.target.value })} />
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={rule.type}
                        onChange={(event) => updateRule(rule.id, { type: event.target.value as DiscountRule["type"] })}
                        className="h-10 w-32 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      >
                        {ruleTypes.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <Input value={rule.code} onChange={(event) => updateRule(rule.id, { code: event.target.value })} className="w-32 font-mono" />
                    </td>
                    <td className="px-3 py-3">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={rule.percent ?? 0}
                        onChange={(event) => updateRule(rule.id, { percent: Math.min(100, Math.max(0, Number(event.target.value) || 0)) })}
                        className="w-24"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <Input value={rule.description} onChange={(event) => updateRule(rule.id, { description: event.target.value })} />
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={rule.enabled ? "true" : "false"}
                        onChange={(event) => updateRule(rule.id, { enabled: event.target.value === "true" })}
                        className="h-10 w-28 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      >
                        <option value="true">Active</option>
                        <option value="false">Disabled</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeRule(rule.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-red-500/10 hover:text-red-600"
                        aria-label={`Remove ${rule.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  )
}
