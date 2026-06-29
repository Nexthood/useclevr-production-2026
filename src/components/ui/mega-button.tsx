"use client"

import { MegaInstallerModal } from "@/components/modals/mega-installer-modal"
import { Button } from "@/components/ui/button"
import { getUseClevrHelperStatus } from "@/lib/hybrid-ai/helper-bridge"
import { Brain } from "lucide-react"
import { useEffect, useState } from "react"

export function MegaButton() {
  const [localAIAvailable, setLocalAIAvailable] = useState<boolean | null>(null)
  const [showInstaller, setShowInstaller] = useState(false)
  const [prefillLite, setPrefillLite] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    getUseClevrHelperStatus()
      .then((status) => setLocalAIAvailable(status.state === "connected"))
      .catch(() => setLocalAIAvailable(false))
  }, [])

  // Open the installer and preselect Lite if redirected with hybrid=lite&setup=1
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('hybrid') === 'lite' && params.get('setup') === '1') {
      setShowInstaller(true)
      setPrefillLite(true)
      // One-time hint; do not mutate history to preserve user back behavior
    }
  }, [])

  // Prevent hydration mismatch - render placeholder until mounted
  if (!mounted || localAIAvailable === null) {
    const buttonClassName = "hidden md:flex items-center gap-2.5 relative overflow-hidden rounded-full border-2 border-primary/45 bg-primary/10 text-primary hover:border-primary/70 hover:bg-primary/15 dark:text-cyan-100 transition-all duration-300 shadow-lg shadow-black/5 hover:shadow-xl dark:shadow-black/30 animate-pulse"

    return (
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          className={buttonClassName}
        >
          <div className="relative z-10 flex items-center gap-2">
            <Brain className="h-4 w-4 animate-bounce" />
            <span className="font-bold text-sm">UseClevr Hybrid AI</span>
            <span className="ml-0.5 px-2 py-0.5 text-[10px] font-bold rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-sm animate-pulse">
              NEW
            </span>
          </div>
          <div className="absolute inset-0 animate-sweep-light bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
          <div className="absolute inset-0 rounded-full bg-primary/5 animate-pulse" />
        </Button>
      </div>
    )
  }

  const buttonClassName = "hidden md:flex items-center gap-2.5 relative overflow-hidden rounded-full border-2 border-primary/45 bg-primary/10 text-primary hover:border-primary/70 hover:bg-primary/15 dark:text-cyan-100 transition-all duration-300 shadow-lg shadow-black/5 hover:shadow-xl dark:shadow-black/30 animate-pulse"

  return (
    <>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          className={buttonClassName}
          onClick={() => setShowInstaller(true)}
        >
          <div className="relative z-10 flex items-center gap-2">
            <Brain className="h-4 w-4 animate-bounce" />
            <span className="font-bold text-sm">UseClevr Hybrid AI</span>
            <span className="ml-0.5 px-2 py-0.5 text-[10px] font-bold rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-sm animate-pulse">
              NEW
            </span>
          </div>
          <div className="absolute inset-0 animate-sweep-light bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
          <div className="absolute inset-0 rounded-full bg-primary/5 animate-pulse" />
        </Button>
      </div>

      <MegaInstallerModal
        open={showInstaller}
        onOpenChange={setShowInstaller}
        preselectTier={prefillLite ? 'lite' : undefined}
      />
    </>
  )
}
