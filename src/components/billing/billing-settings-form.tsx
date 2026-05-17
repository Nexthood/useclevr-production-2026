"use client"

import * as React from "react"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { BillingSettings } from "@/lib/billing/settings-store"

export function BillingSettingsForm({ initialSettings }: { initialSettings: BillingSettings }) {
  const [settings, setSettings] = React.useState(initialSettings)
  const [isSaving, setIsSaving] = React.useState(false)
  const [status, setStatus] = React.useState<string | null>(null)

  const updateCreditCost = (key: keyof BillingSettings["hybridAiCreditCosts"], value: string) => {
    setSettings((current) => ({
      ...current,
      hybridAiCreditCosts: {
        ...current.hybridAiCreditCosts,
        [key]: Math.max(0, Number(value) || 0),
      },
    }))
  }

  const updatePlan = (planId: string, patch: Record<string, unknown>) => {
    setSettings((current) => ({
      ...current,
      plans: current.plans.map((plan) => (plan.id === planId ? { ...plan, ...patch } : plan)),
    }))
  }

  const save = async () => {
    setIsSaving(true)
    setStatus(null)
    try {
      const response = await fetch("/api/admin/billing-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Save failed")
      }

      setSettings(result.settings)
      setStatus("Billing and Hybrid AI settings saved.")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <CreditInput label="Hybrid AI Lite credits" value={settings.hybridAiCreditCosts.lite} onChange={(value) => updateCreditCost("lite", value)} />
        <CreditInput label="Hybrid AI MEGA credits" value={settings.hybridAiCreditCosts.mega} onChange={(value) => updateCreditCost("mega", value)} />
      </div>

      <div className="space-y-4">
        {settings.plans.map((plan) => (
          <div key={plan.id} className="rounded-lg border border-border bg-background p-4">
            <div className="grid gap-4 md:grid-cols-[1fr_1fr_120px]">
              <div className="space-y-2">
                <Label htmlFor={`${plan.id}-title`}>Package title</Label>
                <Input
                  id={`${plan.id}-title`}
                  value={plan.name}
                  onChange={(event) => updatePlan(plan.id, { name: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${plan.id}-description`}>Description</Label>
                <Input
                  id={`${plan.id}-description`}
                  value={plan.description}
                  onChange={(event) => updatePlan(plan.id, { description: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${plan.id}-price`}>Price</Label>
                <Input
                  id={`${plan.id}-price`}
                  type="number"
                  min={0}
                  value={plan.price}
                  onChange={(event) => updatePlan(plan.id, { price: Math.max(0, Number(event.target.value) || 0) })}
                />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor={`${plan.id}-features`}>Package list items</Label>
              <textarea
                id={`${plan.id}-features`}
                value={plan.features.join("\n")}
                onChange={(event) => updatePlan(plan.id, { features: event.target.value.split("\n") })}
                className="min-h-28 w-full rounded-md border border-input bg-background px-4 py-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <p className="text-xs text-muted-foreground">One list item per line.</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button onClick={save} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save settings
        </Button>
        {status && <p className="text-sm text-muted-foreground">{status}</p>}
      </div>
    </div>
  )
}

function CreditInput({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-")

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" min={0} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}
