"use client"

import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import {
  getUseClevrHelperStatus,
  type UseClevrHelperStatus,
} from "@/lib/hybrid-ai/helper-bridge"
import { CheckCircle2, Download, Laptop, Monitor, Server, ShieldCheck } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

type TierId = "lite" | "mega"
const DEFAULT_ALLOWED_TIERS: TierId[] = ["lite", "mega"]

interface MegaInstallerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preselectTier?: TierId
  allowedTiers?: TierId[]
}

type PlatformDownload = {
  id: "windows" | "macos" | "linux"
  label: string
  fileName: string
  href: string
  icon: typeof Monitor
}

const platformDownloads: PlatformDownload[] = [
  {
    id: "windows",
    label: "Windows",
    fileName: "UseClevr-Helper-Setup.exe",
    href: "/api/downloads/windows",
    icon: Monitor,
  },
  {
    id: "macos",
    label: "macOS",
    fileName: "UseClevr-Helper.dmg",
    href: "/api/downloads/macos",
    icon: Laptop,
  },
  {
    id: "linux",
    label: "Linux",
    fileName: "UseClevr-Helper.AppImage",
    href: "/api/downloads/linux",
    icon: Server,
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
}: MegaInstallerModalProps) {
  const [selectedTier, setSelectedTier] = useState<TierId | null>(null)
  const [status, setStatus] = useState<UseClevrHelperStatus>({
    state: "offline",
    message: "UseClevr Helper is not running",
    connected: false,
    privateEngineReady: false,
  })

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
    return tiers.filter((tier) => allowedTiers.includes(tier.id))
  }, [allowedTiers])

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
      description="Private analysis on your device with the UseClevr Helper."
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Private AI Analysis
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Files stay on your device when Hybrid AI is active. UseClevr Helper processes private analysis locally.
              </p>
            </div>
            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${statusClassName(status.state)}`}>
              {status.message}
            </span>
          </div>
          {status.state === "offline" && (
            <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              UseClevr Helper is not running. Start the helper or download it again.
            </p>
          )}
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

        <div>
          <h3 className="text-sm font-semibold text-foreground">Download UseClevr Helper</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Install the desktop helper, start it, then return here to confirm the secure runtime connection.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {platformDownloads.map((platform) => {
              const Icon = platform.icon
              return (
                <a
                  key={platform.id}
                  href={platform.href}
                  className="rounded-lg border border-border bg-card p-4 transition hover:border-primary/50 hover:bg-muted/50"
                >
                  <Icon className="h-5 w-5 text-primary" />
                  <p className="mt-3 text-sm font-semibold text-foreground">{platform.label}</p>
                  <p className="mt-1 break-words text-xs text-muted-foreground">{platform.fileName}</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </span>
                </a>
              )
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" onClick={refreshStatus}>
            Check connection
          </Button>
        </div>
      </div>
    </Modal>
  )
}
