"use client"

import { MegaInstallerModal } from "@/components/mega-installer-modal"
import { Button } from "@/components/ui/button"
import { Brain } from "lucide-react"
import { useEffect, useState } from "react"

export function MegaButton() {
  const [localAIAvailable, setLocalAIAvailable] = useState<boolean | null>(null)
  const [showInstaller, setShowInstaller] = useState(false)
  const [prefillLite, setPrefillLite] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    fetch('/api/local-ai-status')
      .then(res => res.json())
      .then(data => setLocalAIAvailable(data.localAIAvailable))
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
    return (
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          className="hidden md:flex items-center gap-2.5 relative overflow-hidden rounded-full border-2 border-purple-400/60 text-purple-700 dark:text-purple-300 hover:text-purple-800 dark:hover:text-purple-200 hover:border-purple-400/90 dark:hover:border-purple-400 bg-gradient-to-r from-purple-50/90 via-pink-50/50 to-blue-50/90 dark:from-purple-950/30 dark:via-pink-950/20 dark:to-blue-950/30 hover:from-purple-100/90 hover:via-pink-100/60 hover:to-blue-100/90 dark:hover:from-purple-900/40 dark:hover:via-pink-900/30 dark:hover:to-blue-900/40 transition-all duration-500 shadow-lg hover:shadow-xl hover:shadow-purple-500/30 animate-pulse"
        >
          <div className="relative z-10 flex items-center gap-2">
            <Brain className="h-4 w-4 animate-bounce" />
            <span className="font-bold text-sm">Hybrid AI</span>
            <span className="ml-0.5 px-2 py-0.5 text-[10px] font-bold rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-sm animate-pulse">
              NEW
            </span>
          </div>
          <div className="absolute inset-0 animate-sweep-light bg-gradient-to-r from-transparent via-purple-300/20 dark:via-purple-400/15 to-transparent" />
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-blue-600/10 animate-pulse" />
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          className="hidden md:flex items-center gap-2.5 relative overflow-hidden rounded-full border-2 border-purple-400/60 text-purple-700 dark:text-purple-300 hover:text-purple-800 dark:hover:text-purple-200 hover:border-purple-400/90 dark:hover:border-purple-400 bg-gradient-to-r from-purple-50/90 via-pink-50/50 to-blue-50/90 dark:from-purple-950/30 dark:via-pink-950/20 dark:to-blue-950/30 hover:from-purple-100/90 hover:via-pink-100/60 hover:to-blue-100/90 dark:hover:from-purple-900/40 dark:hover:via-pink-900/30 dark:hover:to-blue-900/40 transition-all duration-500 shadow-lg hover:shadow-xl hover:shadow-purple-500/30 animate-pulse"
          onClick={() => setShowInstaller(true)}
        >
          <div className="relative z-10 flex items-center gap-2">
            <Brain className="h-4 w-4 animate-bounce" />
            <span className="font-bold text-sm">Hybrid AI</span>
            <span className="ml-0.5 px-2 py-0.5 text-[10px] font-bold rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-sm animate-pulse">
              NEW
            </span>
          </div>
          <div className="absolute inset-0 animate-sweep-light bg-gradient-to-r from-transparent via-purple-300/20 dark:via-purple-400/15 to-transparent" />
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-blue-600/10 animate-pulse" />
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
