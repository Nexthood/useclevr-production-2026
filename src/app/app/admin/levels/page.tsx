"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Award, Plus, Trash2, Zap } from "lucide-react"
import { useState } from "react"

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

function LevelCard({ level, index, onUpdate, onRemove }: { level: CustomerLevel; index: number; onUpdate: (patch: Partial<CustomerLevel>) => void; onRemove: () => void }) {
  const goals = [
    { key: "minInteractions" as const, label: "Interactions", min: 0 },
    { key: "minPageVisits" as const, label: "Page visits", min: 0 },
    { key: "minUploads" as const, label: "Uploads", min: 0 },
    { key: "minCreditsUsed" as const, label: "Credits used", min: 0 },
    { key: "minLogins" as const, label: "Logins", min: 1 },
  ]

  const gradientMap = ["from-cyan-500/10 to-blue-500/10", "from-purple-500/10 to-pink-500/10", "from-amber-500/10 to-orange-500/10", "from-emerald-500/10 to-teal-500/10", "from-rose-500/10 to-red-500/10"]
  const gradient = gradientMap[index % gradientMap.length]

  return (
    <Card className={`p-5 bg-gradient-to-br ${gradient} border-border/50`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-lg bg-white/60 dark:bg-white/10 flex items-center justify-center">
            <Award className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Level {index + 1}</p>
            <Input
              value={level.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="h-8 mt-1 text-sm font-medium bg-white/50 dark:bg-white/10"
            />
          </div>
        </div>
        <button onClick={onRemove} className="rounded-full p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-600 transition-colors" aria-label="Remove level">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {goals.map((g) => (
          <div key={g.key} className="space-y-1">
            <Label htmlFor={`${level.id}-${g.key}`} className="text-xs">{g.label}</Label>
            <Input
              id={`${level.id}-${g.key}`}
              type="number"
              min={g.min}
              value={level[g.key]}
              onChange={(e) => onUpdate({ [g.key]: Math.max(g.min, Number(e.target.value) || 0) })}
              className="h-8 text-sm"
            />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border/50 bg-white/40 dark:bg-white/5 px-4 py-3 flex items-center gap-2">
        <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <span className="text-xs text-muted-foreground">Reward</span>
        <span className="ml-auto text-sm font-semibold text-foreground">{level.creditReward} credits</span>
        <Input
          type="number"
          min={0}
          value={level.creditReward}
          onChange={(e) => onUpdate({ creditReward: Math.max(0, Number(e.target.value) || 0) })}
          className="h-7 w-20 text-xs"
        />
      </div>
    </Card>
  )
}

export default function AdminLevelsPage() {
  const [levels, setLevels] = useState<CustomerLevel[]>(DEFAULT_LEVELS)
  const [saved, setSaved] = useState<string | null>(null)

  const addLevel = () => {
    setLevels((prev) => [...prev, { id: String(Date.now()), name: `Level ${prev.length + 1}`, minInteractions: 0, minPageVisits: 0, minUploads: 0, minCreditsUsed: 0, minLogins: 1, creditReward: 0 }])
  }

  const updateLevel = (id: string, patch: Partial<CustomerLevel>) => {
    setLevels((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
    setSaved(null)
  }

  const removeLevel = (id: string) => {
    setLevels((prev) => prev.filter((l) => l.id !== id))
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Customer Levels</h2>
          <p className="text-sm text-muted-foreground">Define five customer tiers and the goal thresholds that unlock each level.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addLevel} className="gap-1.5 bg-transparent">
            <Plus className="h-4 w-4" />
            Add level
          </Button>
          <Button size="sm" onClick={save}>
            Save levels
          </Button>
        </div>
      </div>
      {saved && <p className="text-sm text-emerald-600 dark:text-emerald-400">{saved}</p>}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {levels.map((level, i) => (
          <LevelCard
            key={level.id}
            level={level}
            index={i}
            onUpdate={(patch) => updateLevel(level.id, patch)}
            onRemove={() => removeLevel(level.id)}
          />
        ))}
      </div>
    </div>
  )
}
