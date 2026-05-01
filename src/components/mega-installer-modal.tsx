"use client"

import { debugLog, debugError, debugWarn } from "@/lib/debug"



import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Brain, Zap, Cpu, Clock, CheckCircle, XCircle, Pause, Play, Download, AlertCircle } from "lucide-react"

type DownloadState = string

interface DownloadProgress {
  downloaded: number
  total: number
  speed: number
  eta: number
}

interface MegaInstallerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preselectTier?: 'lite' | 'standard'
}

export function MegaInstallerModal({ open, onOpenChange, preselectTier }: MegaInstallerModalProps) {
  const [state, setState] = useState<DownloadState>('idle')
  const [selectedTier, setSelectedTier] = useState<string | null>(null)
  const [progress, setProgress] = useState<DownloadProgress>({ downloaded: 0, total: 0, speed: 0, eta: 0 })
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<number>(0) // 0: runtime, 1: model, 2: service
  type ModelStatus = 'unavailable' | 'installing_runtime' | 'missing_model' | 'downloading' | 'ready' | 'verifying' | 'verified' | 'error'
  const [tierStatus, setTierStatus] = useState<Record<'lite' | 'standard', ModelStatus | null>>({ lite: null, standard: null })
  const [pullError, setPullError] = useState<string | null>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [activated, setActivated] = useState<boolean>(false)

  const tierOptions = [
    {
      id: 'lite',
      name: 'Hybrid AI Lite',
      description: 'Best for normal laptops. Fast install and lightweight offline analysis.',
      size: '~2GB',
      badge: 'Recommended',
      enabled: true,
    },
    {
      id: 'standard',
      name: 'Hybrid AI Standard',
      description: 'Better quality for stronger devices. More capable local analysis.',
      size: '~5GB',
      badge: 'Better quality',
      enabled: true,
    },
    {
      id: 'mega',
      name: 'Hybrid AI MEGA',
      description: 'Coming Soon. Built for high-performance systems and advanced local AI workflows.',
      size: '~15GB',
      badge: 'Coming Soon',
      enabled: false,
    },
  ]
  const abortControllerRef = useRef<AbortController | null>(null)
  const downloadedBytesRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const lastUpdateRef = useRef<number>(0)
  const animationFrameRef = useRef<number | null>(null)
  const isPausedRef = useRef<boolean>(false)
  const [copiedTier, setCopiedTier] = useState<null | 'lite' | 'standard'>(null)
  const [hybridLiteEnabled, setHybridLiteEnabled] = useState<boolean>(false)

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      setState('idle')
      setSelectedTier(null)
      setProgress({ downloaded: 0, total: 0, speed: 0, eta: 0 })
      setError(null)
      setStep(0)
      downloadedBytesRef.current = 0
    }
  }, [open])

  // Minimal guidance: when opened with preselectTier, highlight Lite without auto actions
  useEffect(() => {
    if (!open) return
    if (preselectTier && (preselectTier === 'lite' || preselectTier === 'standard')) {
      setSelectedTier(preselectTier)
    }
  }, [open, preselectTier])

  // Update progress display
  const updateProgress = useCallback((downloaded: number, total: number) => {
    const now = Date.now()
    const elapsed = (now - startTimeRef.current) / 1000
    const speed = downloadedBytesRef.current / elapsed
    const remaining = total - downloadedBytesRef.current
    const eta = speed > 0 ? remaining / speed : 0

    setProgress({
      downloaded: downloadedBytesRef.current,
      total,
      speed,
      eta
    })
    lastUpdateRef.current = now
  }, [])

  // Download with resumable support
  const downloadFile = async (url: string, filename: string, expectedSize: number): Promise<boolean> => {
    abortControllerRef.current = new AbortController()
    startTimeRef.current = Date.now()
    downloadedBytesRef.current = 0

    try {
      // Try to resume from localStorage
      const stored = localStorage.getItem(`download_${filename}`)
      let startByte = 0
      
      if (stored) {
        try {
          const storedData = JSON.parse(stored)
          if (storedData.url === url && storedData.downloaded > 0) {
            startByte = storedData.downloaded
            debugLog(`Resuming ${filename} from byte ${startByte}`)
          }
        } catch (e) {
          // Invalid stored data
        }
      }

      const headers: Record<string, string> = {}
      if (startByte > 0) {
        headers['Range'] = `bytes=${startByte}-`
      }

      const response = await fetch(url, {
        headers,
        signal: abortControllerRef.current.signal
      })

      if (!response.ok && response.status !== 206) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentLength = parseInt(response.headers.get('content-length') || '0')
      const total = startByte + contentLength || expectedSize

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        chunks.push(value)
        downloadedBytesRef.current += value.length
        
        // Update progress every 100ms
        const now = Date.now()
        if (now - lastUpdateRef.current > 100) {
          updateProgress(downloadedBytesRef.current, total)
        }

    // Check for pause
        if (isPausedRef.current) {
          // Save current position
          localStorage.setItem(`download_${filename}`, JSON.stringify({
            url,
            downloaded: downloadedBytesRef.current,
            total
          }))
          reader.cancel()
          return false
        }
      }

      // Combine chunks and save
      const allBytes = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
      let position = 0
      for (const chunk of chunks) {
        allBytes.set(chunk, position)
        position += chunk.length
      }
      const blob = new Blob([allBytes.buffer])
      const url2 = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url2
      a.download = filename
      a.click()
      URL.revokeObjectURL(url2)

      // Clear stored position
      localStorage.removeItem(`download_${filename}`)

      updateProgress(total, total)
      return true

    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Cancelled or paused
        return false
      }
      throw err
    }
  }

  const handleStart = async () => {
    setState('downloading')
    setError(null)
    startTimeRef.current = Date.now()

    try {
      // Step 1: Download Ollama runtime (~100MB)
      setStep(0)
      const runtimeUrl = 'https://github.com/ollama/ollama/releases/download/v0.1.26/Ollama-darwin.zip'
      await downloadFile(runtimeUrl, 'useclevr-hybrid-runtime.zip', 100 * 1024 * 1024)

      if (state === 'paused') return

      // Step 2: Download llama3 model (~5GB)
      setStep(1)
      const modelUrl = 'https://huggingface.co/quantized-models/llama-3-8b-instruct-v1-q4_k_m/resolve/main/llama-3-8b-instruct-v1-q4_k_m.gguf'
      await downloadFile(modelUrl, 'llama3-8 5 * b.gguf',1024 * 1024 * 1024)

      if (state === 'paused') return

      // Step 3: Call installation API
      setStep(2)
      setState('downloading')
      
      const response = await fetch('/api/local-ai-install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const data = await response.json()
      
      if (data.success) {
        setState('completed')
        setTimeout(() => {
          onOpenChange(false)
        }, 2000)
      } else {
        // Map internal installer details to branded message only
        setError('Runtime required')
        setState('error')
      }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Download failed'
      setError(message)
      setState('error')
    }
  }

  const handlePause = () => {
    setState('paused')
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const handleResume = () => {
    setState('resuming')
    // Continue from where we left off
    setTimeout(() => {
      setState('downloading')
    }, 500)
  }

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    // Clear stored downloads
    // Remove both legacy and current keys
    localStorage.removeItem('download_ollama-runtime.zip')
    localStorage.removeItem('download_useclevr-hybrid-runtime.zip')
    localStorage.removeItem('download_llama3-8b.gguf')
    
    setState('idle')
    setProgress({ downloaded: 0, total: 0, speed: 0, eta: 0 })
    setStep(0)
    downloadedBytesRef.current = 0
  }

  // Format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  // Format time
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const percentage = progress.total > 0 ? Math.round((progress.downloaded / progress.total) * 100) : 0
  const stepNames = ['AI Runtime (~100MB)', 'AI Model (~5GB)', 'Installing service']
  const stepDescriptions = [
    'Preparing Local AI',
    'Downloading AI Model',
    'Starting local AI service'
  ]

  // Note: keep hooks above; guard render right before JSX return

  const handleSelectTier = (tierId: string) => {
    // Minimal change: only store selection locally and keep modal on selection screen
    const tier = tierOptions.find(t => t.id === tierId)
    if (tier && tier.enabled) {
      setSelectedTier(tierId)
      // Do not start any install/download yet
    }
  }

  // Map selectable tiers to Ollama model names
  const tierToModel: Record<'lite' | 'standard', string> = {
    lite: 'llama3.2:3b-instruct',
    standard: 'llama3:8b-instruct',
  }

  const getSetupCommand = (tierId: 'lite' | 'standard'): string => {
    const model = tierToModel[tierId]
    return `ollama pull ${model}`
  }

  const copySetupCommand = async (tierId: 'lite' | 'standard') => {
    try {
      await navigator.clipboard.writeText(getSetupCommand(tierId))
      setCopiedTier(tierId)
      setTimeout(() => setCopiedTier(null), 1500)
    } catch {}
  }

  // UseClevr-branded status mapping for UI presentation
  const getBrandedStatus = (s: ModelStatus | null): { label: string; className: string } => {
    switch (s) {
      case null:
        return { label: 'Not installed', className: 'bg-neutral-500/20 text-neutral-400' }
      case 'unavailable':
        return { label: 'Runtime required', className: 'bg-neutral-500/20 text-neutral-400' }
      case 'missing_model':
        return { label: 'Ready to download', className: 'bg-amber-500/20 text-amber-400' }
      case 'installing_runtime':
        return { label: 'Preparing Local AI', className: 'bg-blue-500/20 text-blue-400' }
      case 'downloading':
        return { label: 'Downloading AI Model', className: 'bg-blue-500/20 text-blue-400' }
      case 'verifying':
        return { label: 'Verifying Local AI', className: 'bg-blue-500/20 text-blue-400' }
      case 'verified':
        return { label: 'Ready for Offline Use', className: 'bg-green-500/20 text-green-400' }
      case 'ready':
        return { label: 'Ready to verify', className: 'bg-emerald-500/20 text-emerald-400' }
      case 'error':
        return { label: 'Failed', className: 'bg-red-500/20 text-red-400' }
      default:
        return { label: 'Not installed', className: 'bg-neutral-500/20 text-neutral-400' }
    }
  }

  // Check Ollama reachability and whether the mapped model exists locally
  const checkModelStatus = useCallback(async (tierId: 'lite' | 'standard') => {
    try {
      const res = await fetch('/api/local-ai-status')
      if (!res.ok) {
        setTierStatus(prev => ({ ...prev, [tierId]: 'error' }))
        return
      }
      const data: { available: boolean } = await res.json()
      if (!data.available) {
        setTierStatus(prev => ({ ...prev, [tierId]: 'unavailable' }))
        return
      }

      const tagsRes = await fetch('/api/ollama/tags', { method: 'GET' })
      if (!tagsRes.ok) {
        setTierStatus(prev => ({ ...prev, [tierId]: 'error' }))
        return
      }
      const tagsJson: { models?: Array<{ name: string }> } = await tagsRes.json()
      const models = tagsJson.models || []
      const target = tierToModel[tierId]
      const found = models.some(m => m.name === target)
      setTierStatus(prev => ({ ...prev, [tierId]: found ? 'ready' : 'missing_model' }))
    } catch {
      setTierStatus(prev => ({ ...prev, [tierId]: 'error' }))
    }
  }, [])

  // Trigger status check on selection
  useEffect(() => {
    if (!open) return
    // Initialize activation from cookie for display
    try {
      setActivated((document.cookie || '').includes('useclevr_hybrid=verified'))
      setHybridLiteEnabled(/(?:^|; )hybridAiLiteEnabled=1(?:;|$)/.test(document.cookie || ''))
    } catch {}
    if (selectedTier === 'lite' || selectedTier === 'standard') {
      checkModelStatus(selectedTier)
    }
  }, [selectedTier, open, checkModelStatus])

  // Trigger a real Ollama pull for missing models
  const handlePull = async () => {
    if (selectedTier !== 'lite' && selectedTier !== 'standard') return
    setPullError(null)
    // Guard: only attempt if currently missing_model
    if (tierStatus[selectedTier] !== 'missing_model') return

    // Verify availability again
    try {
      const statusRes = await fetch('/api/local-ai-status')
      if (!statusRes.ok) {
        setTierStatus(prev => ({ ...prev, [selectedTier]: 'error' }))
        return
      }
      const statusData: { available: boolean } = await statusRes.json()
      if (!statusData.available) {
        setTierStatus(prev => ({ ...prev, [selectedTier]: 'unavailable' }))
        return
      }

      setTierStatus(prev => ({ ...prev, [selectedTier]: 'downloading' }))

      const model = tierToModel[selectedTier]
      const res = await fetch('/api/ollama/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model })
      })

      if (!res.ok) {
        // Special-case: runtime is missing/unreachable – map to UseClevr-branded state
        if (res.status === 428) {
          const body: { error?: string; status?: string } = await res.json().catch(() => ({}))
          if (body && body.error === 'runtime_required') {
            // Block pull and show runtime-required state with proper primary action
            setTierStatus(prev => ({ ...prev, [selectedTier]: 'unavailable' }))
            // Do not surface raw backend text in UI for this case
            return
          }
        }
        // Do not surface internal errors; present branded failure
        await res.json().catch(() => ({}))
        setPullError('Download failed')
        setTierStatus(prev => ({ ...prev, [selectedTier]: 'error' }))
        return
      }

      // After successful pull, re-check model presence to confirm readiness
      await checkModelStatus(selectedTier)
    } catch {
      setPullError('Download failed')
      setTierStatus(prev => ({ ...prev, [selectedTier!]: 'error' }))
    }
  }

  // Runtime download entry point (placeholder, OS-agnostic)
  // Minimal action to guide users to install the required local runtime before model download
  const handleDownloadRuntime = useCallback(async () => {
    // Smallest-change OS detection and direct-download trigger
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    const platform = typeof navigator !== 'undefined' ? (navigator.platform || '') : ''

    type OS = 'windows' | 'mac' | 'linux' | 'unknown'
    const detectOS = (): OS => {
      const p = platform.toLowerCase()
      const u = ua.toLowerCase()
      if (p.includes('win') || u.includes('windows')) return 'windows'
      if (p.includes('mac') || u.includes('mac os') || u.includes('darwin')) return 'mac'
      if (p.includes('linux') || u.includes('linux')) return 'linux'
      return 'unknown'
    }

    const os = detectOS()

    // UseClevr-branded direct-download targets (placeholders, ready for real assets)
    const targets: Record<Exclude<OS, 'unknown'>, string> = {
      windows: '/api/downloads/windows',
      mac: '/assets/downloads/UseClevr-Hybrid-Runtime.dmg',
      linux: '/api/downloads/linux',
    }

    const trigger = (url: string, filename?: string) => {
      try {
        const a = document.createElement('a')
        a.href = url
        if (filename) a.download = filename
        a.rel = 'noopener'
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      } catch {}
    }

    const exists = async (url: string): Promise<boolean> => {
      try {
        const res = await fetch(url, { method: 'HEAD' })
        return res.ok
      } catch {
        return false
      }
    }

    if (os === 'unknown') {
      // Minimal chooser via native prompts to avoid UI refactor
      if (window.confirm('Download UseClevr Hybrid AI Runtime for Windows?')) {
        if (await exists(targets.windows)) {
          trigger(targets.windows, 'UseClevr-Hybrid-Runtime-Setup.exe')
        } else {
          setPullError('Runtime installer not available yet for this platform. Please contact support or try again later')
        }
        return
      }
      if (window.confirm('Download UseClevr Hybrid AI Runtime for macOS?')) {
        if (await exists(targets.mac)) {
          trigger(targets.mac, 'UseClevr-Hybrid-Runtime.dmg')
        } else {
          setPullError('Runtime installer not available yet for this platform. Please contact support or try again later')
        }
        return
      }
      if (window.confirm('Download UseClevr Hybrid AI Runtime for Linux?')) {
        if (await exists(targets.linux)) {
          trigger(targets.linux, 'UseClevr-Hybrid-Runtime.AppImage')
        } else {
          setPullError('Runtime installer not available yet for this platform. Please contact support or try again later')
        }
        return
      }
      return
    }

    const mapName: Record<Exclude<OS, 'unknown'>, string> = {
      windows: 'UseClevr-Hybrid-Runtime-Setup.exe',
      mac: 'UseClevr-Hybrid-Runtime.dmg',
      linux: 'UseClevr-Hybrid-Runtime.AppImage',
    }
    if (await exists(targets[os])) {
      trigger(targets[os], mapName[os])
    } else {
      setPullError('Runtime installer not available yet for this platform. Please contact support or try again later')
    }
  }, [])

  // Perform a minimal verification call to the local Ollama endpoint
  const handleVerify = async () => {
    if (selectedTier !== 'lite' && selectedTier !== 'standard') return
    setVerifyError(null)
    if (tierStatus[selectedTier] !== 'ready') return

    // Check reachability again
    try {
      const statusRes = await fetch('/api/local-ai-status')
      if (!statusRes.ok) {
        setTierStatus(prev => ({ ...prev, [selectedTier]: 'error' }))
        return
      }
      const statusData: { available: boolean } = await statusRes.json()
      if (!statusData.available) {
        setTierStatus(prev => ({ ...prev, [selectedTier]: 'unavailable' }))
        return
      }

      setTierStatus(prev => ({ ...prev, [selectedTier]: 'verifying' }))
      const model = tierToModel[selectedTier]
      const res = await fetch('/api/ollama/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model })
      })

      if (!res.ok) {
        await res.json().catch(() => ({}))
        setVerifyError('Verification failed')
        // Fall back to ready (model exists) but with error state per requirements
        setTierStatus(prev => ({ ...prev, [selectedTier]: 'error' }))
        return
      }

      // Success
      setTierStatus(prev => ({ ...prev, [selectedTier]: 'verified' }))
    } catch {
      setVerifyError('Verification failed')
      setTierStatus(prev => ({ ...prev, [selectedTier!]: 'error' }))
    }
  }

  // Explicit activation of Hybrid AI local mode (persisted via cookie gate)
  const handleActivate = () => {
    if (selectedTier !== 'lite' && selectedTier !== 'standard') return
    if (tierStatus[selectedTier] !== 'verified') return
    try {
      document.cookie = `useclevr_hybrid=verified; path=/; max-age=86400`
      setActivated(true)
    } catch {}
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={() => !['downloading', 'paused'].includes(state) && onOpenChange(false)}
      />
      
      {/* Modal */}
      <Card className="relative z-10 w-full max-w-lg p-6 bg-background shadow-xl">
        {state === 'completed' ? (
          <div className="text-center py-8">
            <div className="text-green-500 text-5xl mb-4">✓</div>
            <h2 className="text-xl font-semibold text-green-500 mb-2">
              {selectedTier === 'lite' ? 'Hybrid AI Lite' : selectedTier === 'standard' ? 'Hybrid AI Standard' : 'Hybrid AI'} installed
            </h2>
            <p className="text-muted-foreground">
              Hybrid mode active
            </p>
          </div>
        ) : state === 'idle' ? (
          // Tier Selection Screen
          <>
            <h2 className="text-xl font-semibold mb-2">
              Select Hybrid AI
            </h2>
            <p className="text-sm text-muted-foreground mb-2">
              Choose a local AI engine for offline analysis. Your data stays on your device.
            </p>
            <p className="text-xs text-amber-400/80 mb-6">
              Not every device can run every local AI mode. Lite and Standard are available now. MEGA is coming soon for high-performance systems.
            </p>

            <div className="space-y-3">
              {tierOptions.map((tier) => (
                <button
                  key={tier.id}
                  onClick={() => handleSelectTier(tier.id)}
                  disabled={!tier.enabled}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    tier.enabled
                      ? `${selectedTier === tier.id 
                          ? 'border-purple-500/50 bg-purple-500/5' 
                          : 'border-border hover:border-purple-500/50 hover:bg-purple-500/5'} cursor-pointer` 
                      : 'border-border/50 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{tier.name}</span>
                        {tier.badge && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            tier.id === 'lite' 
                              ? 'bg-cyan-500/20 text-cyan-400' 
                              : tier.id === 'standard'
                                ? 'bg-purple-500/20 text-purple-400'
                                : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {tier.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{tier.description}</p>
                      <p className="text-xs text-muted-foreground/70 mt-2">Download size: {tier.size}</p>
                    </div>
                    {selectedTier === tier.id && (tier.id === 'lite' || tier.id === 'standard') && (
                      (() => {
                        const s = tierStatus[tier.id as 'lite' | 'standard']
                        const branded = getBrandedStatus(s)
                        return (
                          <span className={`ml-3 self-start text-xs px-2 py-0.5 rounded-full ${branded.className}`}>
                            {branded.label}
                          </span>
                        )
                      })()
                    )}
                    {!tier.enabled && (
                      <span className="text-xs text-muted-foreground">Coming Soon</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
            {(selectedTier === 'lite' || selectedTier === 'standard') && (
              <div className="mt-3 flex items-center justify-between">
                {(() => {
                  const branded = getBrandedStatus(tierStatus[selectedTier])
                  return (
                    <div className="text-xs text-muted-foreground">
                      {branded.label}
                    </div>
                  )
                })()}
                {/* Standard tier: keep locked/coming soon - no actions */}
                {selectedTier === 'standard' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-500/20 text-neutral-400">Coming Soon</span>
                )}
                {/* Lite tier monetization gate */}
                {selectedTier === 'lite' && !hybridLiteEnabled && (
                  <Button onClick={() => { window.location.href = '/pricing' }} size="sm" className="bg-purple-600 hover:bg-purple-700">
                    Unlock Hybrid AI Lite
                  </Button>
                )}
                {selectedTier === 'lite' && hybridLiteEnabled && tierStatus[selectedTier] === 'unavailable' && (
                  <div className="flex items-center gap-2">
                    <code className="text-xs px-2 py-1 rounded bg-muted text-foreground/90">
                      {getSetupCommand(selectedTier)}
                    </code>
                    <Button onClick={() => copySetupCommand(selectedTier)} size="sm" className="bg-purple-600 hover:bg-purple-700">
                      {copiedTier === selectedTier ? 'Copied' : 'Copy Setup Command'}
                    </Button>
                  </div>
                )}
                {selectedTier !== 'standard' && tierStatus[selectedTier] === 'installing_runtime' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">Preparing Local AI</span>
                )}
                {selectedTier === 'lite' && hybridLiteEnabled && tierStatus[selectedTier] === 'missing_model' && (
                  <div className="flex items-center gap-2">
                    <code className="text-xs px-2 py-1 rounded bg-muted text-foreground/90">
                      {getSetupCommand(selectedTier)}
                    </code>
                    <Button onClick={() => copySetupCommand(selectedTier)} size="sm" className="bg-purple-600 hover:bg-purple-700">
                      {copiedTier === selectedTier ? 'Copied' : 'Copy Setup Command'}
                    </Button>
                  </div>
                )}
                {selectedTier !== 'standard' && tierStatus[selectedTier] === 'downloading' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">Downloading AI Model</span>
                )}
                {selectedTier !== 'standard' && tierStatus[selectedTier] === 'ready' && (
                  <Button onClick={handleVerify} size="sm" className="bg-green-600 hover:bg-green-700">
                    Verify Local AI
                  </Button>
                )}
                {selectedTier !== 'standard' && tierStatus[selectedTier] === 'verifying' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">Verifying Local AI</span>
                )}
                {selectedTier !== 'standard' && tierStatus[selectedTier] === 'verified' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Ready for Offline Use</span>
                    {!activated ? (
                      <Button onClick={handleActivate} size="sm" className="bg-green-600 hover:bg-green-700">
                        Activate Hybrid AI
                      </Button>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">Hybrid AI Enabled</span>
                    )}
                  </div>
                )}
                {/* Guard UI claims: if runtime becomes unavailable while activated, show blocked state */}
                {activated && tierStatus[selectedTier] === 'unavailable' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-500/20 text-neutral-400">Runtime required</span>
                )}
                {tierStatus[selectedTier] === 'error' && (
                  <Button
                    onClick={() => {
                      if (selectedTier === 'lite' || selectedTier === 'standard') {
                        checkModelStatus(selectedTier)
                      }
                    }}
                    size="sm"
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Retry
                  </Button>
                )}
              </div>
            )}
            {pullError && (
              <div className="mt-2 text-xs text-red-400">{pullError}</div>
            )}
            {verifyError && (
              <div className="mt-2 text-xs text-red-400">{verifyError}</div>
            )}
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-2">
              Install {selectedTier === 'lite' ? 'Hybrid AI Lite' : selectedTier === 'standard' ? 'Hybrid AI Standard' : 'Hybrid AI'}
            </h2>
            
            <p className="text-sm text-muted-foreground mb-6">
              {selectedTier === 'lite' 
                ? "Fast install with a lightweight model. Best for basic CSV analysis and quick insights."
                : selectedTier === 'standard'
                  ? "Higher quality model for deeper analysis. Best for complex datasets and advanced questions."
                  : "Download and install a local AI engine."
              }
              <br />
              {selectedTier === 'lite' && "~2GB download • Estimated 3-5 minutes"}
              {selectedTier === 'standard' && "~5GB download • Estimated 8-15 minutes"}
            </p>

            {/* Progress Section */}
            {(state === 'downloading' || state === 'paused' || state === 'resuming') && (
              <div className="mb-6 space-y-3">
                {/* Current Step */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Step {step + 1}: {stepNames[step]}</span>
                  <span className="text-muted-foreground">{percentage}%</span>
                </div>

                {/* Progress Bar */}
                <div className="h-3 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Downloaded</p>
                    <p className="font-medium">
                      {formatBytes(progress.downloaded)} / {formatBytes(progress.total)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Speed / ETA</p>
                    <p className="font-medium">
                      {formatBytes(progress.speed)}/s • {formatTime(progress.eta)} remaining
                    </p>
                  </div>
                </div>

                {/* State Badge */}
                <div className="flex items-center justify-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    state === 'downloading' ? 'bg-blue-500/20 text-blue-400' :
                    state === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
                    state === 'resuming' ? 'bg-orange-500/20 text-orange-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {state === 'downloading' && '⬇️ Downloading'}
                    {state === 'paused' && '⏸️ Paused'}
                    {state === 'resuming' && '⏳ Resuming...'}
                  </span>
                </div>
              </div>
            )}

            {/* Error */}
            {error && state === 'error' && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-md">
                <p className="text-sm text-red-400 whitespace-pre-wrap">{error}</p>
              </div>
            )}

            {/* Control Buttons */}
            <div className="flex gap-3">
              {state === 'idle' || state === 'error' ? (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => onOpenChange(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleStart}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    {state === 'error' ? 'Retry Install' : 'Start Install'}
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    variant="outline"
                    onClick={handleCancel}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  {state === 'downloading' ? (
                    <Button 
                      onClick={handlePause}
                      className="flex-1 bg-yellow-600 hover:bg-yellow-700"
                    >
                      ⏸️ Pause
                    </Button>
                  ) : state === 'paused' ? (
                    <Button 
                      onClick={handleResume}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      ▶️ Resume
                    </Button>
                  ) : (
                    <Button 
                      disabled
                      className="flex-1"
                    >
                      {state === 'resuming' ? 'Resuming...' : 'Please wait...'}
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* Steps Preview */}
            {state === 'idle' && (
              <div className="mt-6 space-y-3">
                {stepNames.map((name, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      idx <= step ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {idx < step ? '✓' : idx + 1}
                    </div>
                    <p className={`text-sm ${idx <= step ? '' : 'text-muted-foreground'}`}>
                      {name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
