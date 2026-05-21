"use client"

import { AppPageHeader } from "@/components/layout/app-page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"

export type CustomerLevel = {
  id: string
  name: string
  minInteractions: number
  minPageVisits: number
  minUploads: number
  minCreditsUsed: number
  minLogins: number
  creditReward: number
}

const DEFAULT_LEVELS: CustomerLevel[] = [
  { id: "1", name: "Explorer", minInteractions: 1, minPageVisits: 1, minUploads: 0, minCreditsUsed: 0, minLogins: 1, creditReward: 1 },
  { id: "2", name: "Analyst", minInteractions: 5, minPageVisits: 3, minUploads: 1, minCreditsUsed: 2, minLogins: 3, creditReward: 2 },
  { id: "3", name: "Strategist", minInteractions: 15, minPageVisits: 8, minUploads: 3, minCreditsUsed: 5, minLogins: 7, creditReward: 5 },
  { id: "4", name: "Expert", minInteractions: 40, minPageVisits: 20, minUploads: 8, minCreditsUsed: 15, minLogins: 15, creditReward: 10 },
  { id: "5", name: "Champion", minInteractions: 100, minPageVisits: 50, minUploads: 20, minCreditsUsed: 40, minLogins: 30, creditReward: 20 },
]

const numericFields = [
  { key: "minInteractions" as const, label: "Interactions", min: 0 },
  { key: "minPageVisits" as const, label: "Visits", min: 0 },
  { key: "minUploads" as const, label: "Uploads", min: 0 },
  { key: "minCreditsUsed" as const, label: "Credits", min: 0 },
  { key: "minLogins" as const, label: "Logins", min: 1 },
  { key: "creditReward" as const, label: "Reward", min: 0 },
]

export default function AdminLevelsPage() {
  const [levels, setLevels] = useState<CustomerLevel[]>(DEFAULT_LEVELS)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/admin/levels", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.levels) && data.levels.length > 0) setLevels(data.levels)
      })
      .catch(() => undefined)
  }, [])

  const addLevel = () => {
    setLevels((prev) => [...prev, { id: String(Date.now()), name: `Level ${prev.length + 1}`, minInteractions: 0, minPageVisits: 0, minUploads: 0, minCreditsUsed: 0, minLogins: 1, creditReward: 0 }])
    setSaved(null)
  }

  const updateLevel = (id: string, patch: Partial<CustomerLevel>) => {
    setLevels((prev) => prev.map((level) => (level.id === id ? { ...level, ...patch } : level)))
    setSaved(null)
  }

  const removeLevel = (id: string) => {
    setLevels((prev) => prev.filter((level) => level.id !== id))
    setSaved(null)
  }

  const save = async () => {
    try {
      const res = await fetch("/api/admin/levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ levels }),
      })
      if (!res.ok) throw new Error("Save failed")
      setSaved("Levels saved.")
    } catch {
      setSaved("Save failed. Try again.")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppPageHeader
        title="Customer Levels"
        description="Define customer tiers and the activity thresholds that unlock each level."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Customer Levels" },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addLevel} className="gap-1.5 bg-transparent">
              <Plus className="h-4 w-4" />
              Add level
            </Button>
            <Button size="sm" onClick={save}>
              Save
            </Button>
          </div>
        }
      />

      <main className="px-5 py-5">
        <Card className="overflow-hidden border-border bg-card">
          {saved && <p className="border-b border-border px-5 py-3 text-sm text-muted-foreground">{saved}</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Level</th>
                  {numericFields.map((field) => (
                    <th key={field.key} className="px-3 py-3 font-medium">{field.label}</th>
                  ))}
                  <th className="px-4 py-3 text-right font-medium">Remove</th>
                </tr>
              </thead>
              <tbody>
                {levels.map((level, index) => (
                  <tr key={level.id} className="border-b border-border/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-14 text-xs text-muted-foreground">#{index + 1}</span>
                        <Input value={level.name} onChange={(event) => updateLevel(level.id, { name: event.target.value })} />
                      </div>
                    </td>
                    {numericFields.map((field) => (
                      <td key={field.key} className="px-3 py-3">
                        <Input
                          type="number"
                          min={field.min}
                          value={level[field.key]}
                          onChange={(event) => updateLevel(level.id, { [field.key]: Math.max(field.min, Number(event.target.value) || 0) })}
                          className="w-24"
                        />
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeLevel(level.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-red-500/10 hover:text-red-600"
                        aria-label={`Remove ${level.name}`}
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
