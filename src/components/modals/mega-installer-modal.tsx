"use client"

import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import {
  getUseClevrHelperStatus,
  type UseClevrHelperStatus,
} from "@/lib/hybrid-ai/helper-bridge"
import {
  getHybridAiEntitlement,
  HYBRID_AI_MODULES,
  type HybridAiModuleId,
} from "@/lib/hybrid-ai/features"
import { CheckCircle2, Laptop, LockKeyhole, Monitor, PlugZap, Server } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"

type TierId = "lite" | "mega"
const DEFAULT_ALLOWED_TIERS: TierId[] = ["lite", "mega"]

interface MegaInstallerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preselectTier?: TierId
  allowedTiers?: TierId[]
  subscriptionTier?: string | null
  userRole?: string | null
}

type PlatformDownload = {
  id: "windows" | "macos" | "linux"
  label: string
  fileName: string
  icon: typeof Monitor
}

const platformDownloads: PlatformDownload[] = [
  {
    id: "windows",
    label: "Windows",
    fileName: "UseClevr-Helper-Setup.exe",
    icon: Monitor,
  },
  {
    id: "macos",
    label: "macOS",
    fileName: "UseClevr-Helper.dmg",
    icon: Laptop,
  },
  {
    id: "linux",
    label: "Linux",
    fileName: "UseClevr-Helper.AppImage",
    icon: Server,
  },
]

const byoaiOptions = [
  {
    name: "Ollama",
    description: "Connect a local endpoint such as http://localhost:11434/v1.",
  },
  {
    name: "LM Studio",
    description: "Use a local OpenAI-compatible server from your desktop workspace.",
  },
  {
    name: "OpenAI-compatible endpoint",
    description: "Connect hosted or private engines that support chat completions.",
  },
  {
    name: "vLLM",
    description: "Route analysis to an enterprise inference server you already operate.",
  },
]

function statusClassName(state: UseClevrHelperStatus["state"]) {
  if (state === "connected") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  if (state === "setup") return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  return "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
}

export function MegaInstallerModal({
  open,
  onOpenChange,
  preselectTier,
  allowedTiers = DEFAULT_ALLOWED_TIERS,
  subscriptionTier = "free",
  userRole,
}: MegaInstallerModalProps) {
  const [selectedTier, setSelectedTier] = useState<TierId | null>(null)
  const [status, setStatus] = useState<UseClevrHelperStatus>({
    state: "offline",
    message: "UseClevr Helper is not running",
    connected: false,
    privateEngineReady: false,
    features: HYBRID_AI_MODULES.reduce((features, module) => {
      features[module.id] = true
      return features
    }, {} as Record<HybridAiModuleId, boolean>),
  })
  const entitlement = useMemo(
    () => getHybridAiEntitlement(subscriptionTier, userRole),
    [subscriptionTier, userRole],
  )

  const visibleTierOptions = useMemo(() => {
    const tiers = [
      {
        id: "lite" as const,
        name: "UseClevr Hybrid AI Lite",
        description: "Private AI Analysis for everyday business questions.",
        badge: "Pro",
      },
      {
        id: "mega" as const,
        name: "UseClevr Hybrid AI MEGA",
        description: "Enhanced Private AI Analysis for business workstations.",
        badge: "Business",
      },
    ]
    return tiers.filter((tier) => allowedTiers.includes(tier.id) && (tier.id === "lite" ? entitlement.canUseLite : entitlement.canUseMega))
  }, [allowedTiers, entitlement.canUseLite, entitlement.canUseMega])

  const availableModules = useMemo(
    () => HYBRID_AI_MODULES.filter((module) => entitlement.enabledModuleIds.includes(module.id) && status.features[module.id]),
    [entitlement.enabledModuleIds, status.features],
  )
  const lockedMegaModules = useMemo(
    () => HYBRID_AI_MODULES.filter((module) => module.tier === "mega" && !entitlement.canUseMega && status.features[module.id]),
    [entitlement.canUseMega, status.features],
  )

  const refreshStatus = useCallback(async () => {
    setStatus(await getUseClevrHelperStatus())
  }, [])

  useEffect(() => {
    if (!open) return
    if (preselectTier && allowedTiers.includes(preselectTier)) {
      setSelectedTier(preselectTier)
    } else {
      setSelectedTier(allowedTiers[0] || null)
    }
    void refreshStatus()
  }, [allowedTiers, open, preselectTier, refreshStatus])

  useEffect(() => {
    if (!open) return
    const timer = window.setInterval(() => void refreshStatus(), 8000)
    return () => window.clearInterval(timer)
  }, [open, refreshStatus])

  if (!open) return null

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="UseClevr Hybrid AI"
      description="Connect your existing AI engine first. UseClevr Helper arrives later for advanced automation."
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <PlugZap className="h-4 w-4 text-primary" />
                Recommended: Connect Existing AI
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                BYOAI is Phase 1 for Hybrid AI. Connect a local or hosted AI provider and UseClevr routes analysis through it with fallback.
              </p>
            </div>
            <Link
              href="/app/settings/ai-providers"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Connect AI Provider
            </Link>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {byoaiOptions.map((option) => (
              <div key={option.name} className="rounded-md border border-border bg-card/80 p-3">
                <p className="text-xs font-semibold text-foreground">{option.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">Unlocked modules</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Your subscription controls which Hybrid AI modules UseClevr can unlock as provider capabilities expand.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {availableModules.map((module) => (
              <div key={module.id} className="rounded-md border border-emerald-500/25 bg-emerald-500/10 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {module.name}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{module.description}</p>
              </div>
            ))}
            {lockedMegaModules.slice(0, 4).map((module) => (
              <div key={module.id} className="rounded-md border border-border bg-muted/50 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <LockKeyhole className="h-3.5 w-3.5" />
                  {module.name}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{module.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {visibleTierOptions.map((tier) => (
            <button
              key={tier.id}
              type="button"
              onClick={() => setSelectedTier(tier.id)}
              className={`rounded-lg border p-4 text-left transition ${
                selectedTier === tier.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{tier.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{tier.description}</p>
                </div>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {tier.badge}
                </span>
              </div>
              {selectedTier === tier.id && (
                <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Selected
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">UseClevr Helper</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Phase 2 will add a UseClevr-managed desktop runtime for advanced automation, local workflows, and future enterprise modules.
              </p>
            </div>
            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${statusClassName(status.state)}`}>
              {status.message}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Downloads are coming soon and stay disabled until signed binaries are available.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {platformDownloads.map((platform) => {
              const Icon = platform.icon
              return (
                <div
                  key={platform.id}
                  className="rounded-lg border border-border bg-card/70 p-4 opacity-80"
                >
                  <Icon className="h-5 w-5 text-primary" />
                  <p className="mt-3 text-sm font-semibold text-foreground">{platform.label}</p>
                  <p className="mt-1 break-words text-xs text-muted-foreground">{platform.fileName}</p>
                  <span className="mt-3 inline-flex items-center rounded-full border border-border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                    Coming soon
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" onClick={refreshStatus}>
            Check helper status
          </Button>
        </div>
      </div>
    </Modal>
  )
}
