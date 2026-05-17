"use client"

import { debugLog, debugError, debugWarn } from "@/lib/utils/debug"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { Brain, Zap, Cpu, Clock, CheckCircle, XCircle, Pause, Play, Download, AlertCircle } from "lucide-react"

type DownloadState = string
type TierId = 'lite' | 'mega'
const DEFAULT_ALLOWED_TIERS: TierId[] = ['lite', 'mega']

interface DownloadProgress {
  downloaded: number
  total: number
  speed: number
  eta: number
}

interface MegaInstallerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preselectTier?: TierId
  allowedTiers?: TierId[]
}

export function MegaInstallerModal({ open, onOpenChange, preselectTier, allowedTiers = DEFAULT_ALLOWED_TIERS }: MegaInstallerModalProps) {
  const [state, setState] = useState<DownloadState>('idle')
  const [selectedTier, setSelectedTier] = useState<TierId | null>(null)
  const [progress, setProgress] = useState<DownloadProgress>({ downloaded: 0, total: 0, speed: 0, eta: 0 })
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<number>(0)
  type ModelStatus = 'unavailable' | 'installing_runtime' | 'missing_model' | 'downloading' | 'ready' | 'verifying' | 'verified' | 'error'
  const [tierStatus, setTierStatus] = useState<Record<TierId, ModelStatus | null>>({ lite: null, mega: null })
  const [pullError, setPullError] = useState<string | null>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [activated, setActivated] = useState<boolean>(false)

  const tierOptions = [
    { id: 'lite', name: 'Hybrid AI Lite', description: 'Fast setup for everyday private analysis.', size: '~2GB', badge: 'Recommended', enabled: true },
    { id: 'mega', name: 'Hybrid AI MEGA', description: 'Higher-capacity setup for business workstations.', size: '~5GB', badge: 'Business', enabled: true },
  ] satisfies Array<{ id: TierId; name: string; description: string; size: string; badge: string; enabled: boolean }>
  const visibleTierOptions = tierOptions.filter((tier) => allowedTiers.includes(tier.id))
  const abortControllerRef = useRef<AbortController | null>(null)
  const downloadedBytesRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const lastUpdateRef = useRef<number>(0)
  const animationFrameRef = useRef<number | null>(null)
  const isPausedRef = useRef<boolean>(false)

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort()
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setState('idle')
      setSelectedTier(null)
      setProgress({ downloaded: 0, total: 0, speed: 0, eta: 0 })
      setError(null)
      setStep(0)
      setTierStatus({ lite: null, mega: null })
      setPullError(null)
      setVerifyError(null)
      downloadedBytesRef.current = 0
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    if (preselectTier && allowedTiers.includes(preselectTier)) {
      setSelectedTier(preselectTier)
    } else {
      setSelectedTier(allowedTiers[0] || null)
    }
  }, [open, preselectTier, allowedTiers])

  const updateProgress = useCallback((downloaded: number, total: number) => {
    const now = Date.now()
    const elapsed = (now - startTimeRef.current) / 1000
    const speed = downloadedBytesRef.current / elapsed
    const remaining = total - downloadedBytesRef.current
    const eta = speed > 0 ? remaining / speed : 0
    setProgress({ downloaded: downloadedBytesRef.current, total, speed, eta })
    lastUpdateRef.current = now
  }, [])

  const downloadFile = async (url: string, filename: string, expectedSize: number): Promise<boolean> => {
    abortControllerRef.current = new AbortController()
    startTimeRef.current = Date.now()
    downloadedBytesRef.current = 0
    try {
      const stored = localStorage.getItem(`download_${filename}`)
      let startByte = 0
      if (stored) {
        try {
          const storedData = JSON.parse(stored)
          if (storedData.url === url && storedData.downloaded > 0) startByte = storedData.downloaded
        } catch {}
      }
      const headers: Record<string, string> = {}
      if (startByte > 0) headers['Range'] = `bytes=${startByte}-`
      const response = await fetch(url, { headers, signal: abortControllerRef.current.signal })
      if (!response.ok && response.status !== 206) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      const contentLength = parseInt(response.headers.get('content-length') || '0')
      const total = startByte + contentLength || expectedSize
      if (!response.body) throw new Error('No response body')
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        downloadedBytesRef.current += value.length
        const now = Date.now()
        if (now - lastUpdateRef.current > 100) updateProgress(downloadedBytesRef.current, total)
        if (isPausedRef.current) {
          localStorage.setItem(`download_${filename}`, JSON.stringify({ url, downloaded: downloadedBytesRef.current, total }))
          reader.cancel()
          return false
        }
      }
      const allBytes = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
      let position = 0
      for (const chunk of chunks) { allBytes.set(chunk, position); position += chunk.length }
      const blob = new Blob([allBytes.buffer])
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      a.click()
      URL.revokeObjectURL(blobUrl)
      localStorage.removeItem(`download_${filename}`)
      updateProgress(total, total)
      return true
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return false
      throw err
    }
  }

  const handleStart = async () => {
    setState('downloading')
    setError(null)
    startTimeRef.current = Date.now()
    try {
      setStep(0)
      const runtimeUrl = 'https://github.com/ollama/ollama/releases/download/v0.1.26/UseClevr-Hybrid-Runtime.zip'
      await downloadFile(runtimeUrl, 'useclevr-hybrid-runtime.zip', 100 * 1024 * 1024)
      if (state === 'paused') return
      setStep(1)
      const modelUrl = 'https://huggingface.co/quantized-models/llama-3-8b-instruct-v1-q4_k_m/resolve/main/llama-3-8b-instruct-v1-q4_k_m.gguf'
      await downloadFile(modelUrl, 'llama3-8 5 * b.gguf', 1024 * 1024 * 1024)
      if (state === 'paused') return
      setStep(2)
      setState('downloading')
      const response = await fetch('/api/local-ai-install', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      const data = await response.json()
      if (data.success) {
        setState('completed')
        setTimeout(() => onOpenChange(false), 2000)
      } else {
        setError('Desktop helper needed')
        setState('error')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Download failed'
      setError(message)
      setState('error')
    }
  }

  const handlePause = () => { setState('paused'); if (abortControllerRef.current) abortControllerRef.current.abort() }
  const handleResume = () => { setState('resuming'); setTimeout(() => setState('downloading'), 500) }
  const handleCancel = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort()
    localStorage.removeItem('download_ollama-runtime.zip')
    localStorage.removeItem('download_useclevr-hybrid-runtime.zip')
    localStorage.removeItem('download_llama3-8b.gguf')
    setState('idle')
    setProgress({ downloaded: 0, total: 0, speed: 0, eta: 0 })
    setStep(0)
    downloadedBytesRef.current = 0
  }

  const formatBytes = (bytes: number) => { if (bytes === 0) return '0 B'; const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB']; const i = Math.floor(Math.log(bytes) / Math.log(k)); return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}` }
  const formatTime = (seconds: number) => { if (!isFinite(seconds) || seconds < 0) return '--:--'; const mins = Math.floor(seconds / 60); const secs = Math.floor(seconds % 60); return `${mins}:${secs.toString().padStart(2, '0')}` }
  const percentage = progress.total > 0 ? Math.round((progress.downloaded / progress.total) * 100) : 0
  const stepNames = ['Desktop helper', 'Hybrid AI download', 'Activation']

  const handleSelectTier = (tierId: TierId) => {
    const tier = tierOptions.find(t => t.id === tierId)
    if (tier && tier.enabled) setSelectedTier(tierId)
  }

  const tierToModel: Record<TierId, string> = { lite: 'llama3.2:3b-instruct', mega: 'llama3:8b-instruct' }

  const getBrandedStatus = (s: ModelStatus | null) => {
    switch (s) {
      case null: return { label: 'Not set up', className: 'bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100' }
      case 'unavailable': return { label: 'Desktop helper needed', className: 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100' }
      case 'missing_model': return { label: 'Ready to download', className: 'bg-cyan-100 text-cyan-950 dark:bg-cyan-950 dark:text-cyan-100' }
      case 'installing_runtime': return { label: 'Preparing Hybrid AI', className: 'bg-cyan-100 text-cyan-950 dark:bg-cyan-950 dark:text-cyan-100' }
      case 'downloading': return { label: 'Downloading Hybrid AI', className: 'bg-cyan-100 text-cyan-950 dark:bg-cyan-950 dark:text-cyan-100' }
      case 'verifying': return { label: 'Checking setup', className: 'bg-cyan-100 text-cyan-950 dark:bg-cyan-950 dark:text-cyan-100' }
      case 'verified': return { label: 'Ready for private analysis', className: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100' }
      case 'ready': return { label: 'Ready to check', className: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100' }
      case 'error': return { label: 'Needs attention', className: 'bg-red-100 text-red-950 dark:bg-red-950 dark:text-red-100' }
      default: return { label: 'Not set up', className: 'bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100' }
    }
  }

  const checkModelStatus = useCallback(async (tierId: TierId) => {
    try {
      const res = await fetch('/api/local-ai-status')
      if (!res.ok) { setTierStatus(prev => ({ ...prev, [tierId]: 'error' })); return }
      const data: { available: boolean } = await res.json()
      if (!data.available) { setTierStatus(prev => ({ ...prev, [tierId]: 'unavailable' })); return }
      const tagsRes = await fetch('/api/ollama/tags', { method: 'GET' })
      if (!tagsRes.ok) { setTierStatus(prev => ({ ...prev, [tierId]: 'error' })); return }
      const tagsJson: { models?: Array<{ name: string }> } = await tagsRes.json()
      const models = tagsJson.models || []
      const target = tierToModel[tierId]
      const found = models.some(m => m.name === target)
      setTierStatus(prev => ({ ...prev, [tierId]: found ? 'ready' : 'missing_model' }))
    } catch { setTierStatus(prev => ({ ...prev, [tierId]: 'error' })) }
  }, [])

  useEffect(() => {
    if (!open) return
    try { setActivated((document.cookie || '').includes('useclevr_hybrid=verified')) } catch {}
    if (selectedTier === 'lite' || selectedTier === 'mega') checkModelStatus(selectedTier)
  }, [selectedTier, open, checkModelStatus])

  const handlePull = async () => {
    if (selectedTier !== 'lite' && selectedTier !== 'mega') return
    setPullError(null)
    if (tierStatus[selectedTier] !== 'missing_model') return
    try {
      const statusRes = await fetch('/api/local-ai-status')
      if (!statusRes.ok) { setTierStatus(prev => ({ ...prev, [selectedTier]: 'error' })); return }
      const statusData: { available: boolean } = await statusRes.json()
      if (!statusData.available) { setTierStatus(prev => ({ ...prev, [selectedTier]: 'unavailable' })); return }
      setTierStatus(prev => ({ ...prev, [selectedTier]: 'downloading' }))
      const model = tierToModel[selectedTier]
      const res = await fetch('/api/ollama/pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) })
      if (!res.ok) {
        if (res.status === 428) {
          const body: { error?: string } = await res.json().catch(() => ({}))
          if (body?.error === 'runtime_required') { setTierStatus(prev => ({ ...prev, [selectedTier]: 'unavailable' })); return }
        }
        await res.json().catch(() => ({}))
        setPullError('Download failed')
        setTierStatus(prev => ({ ...prev, [selectedTier]: 'error' }))
        return
      }
      await checkModelStatus(selectedTier)
    } catch { setPullError('Download failed'); setTierStatus(prev => ({ ...prev, [selectedTier!]: 'error' })) }
  }

  const handleDownloadRuntime = useCallback(async () => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    const platform = typeof navigator !== 'undefined' ? (navigator.platform || '') : ''
    type OS = 'windows' | 'mac' | 'linux' | 'unknown'
    const detectOS = (): OS => {
      const p = platform.toLowerCase(), u = ua.toLowerCase()
      if (p.includes('win') || u.includes('windows')) return 'windows'
      if (p.includes('mac') || u.includes('mac os') || u.includes('darwin')) return 'mac'
      if (p.includes('linux') || u.includes('linux')) return 'linux'
      return 'unknown'
    }
    const os = detectOS()
    const targets: Record<Exclude<OS, 'unknown'>, string> = { windows: '/api/downloads/windows', mac: '/assets/downloads/UseClevr-Hybrid-Runtime.dmg', linux: '/api/downloads/linux' }
    const trigger = (url: string, filename?: string) => { try { const a = document.createElement('a'); a.href = url; if (filename) a.download = filename; a.rel = 'noopener'; a.style.display = 'none'; document.body.appendChild(a); a.click(); document.body.removeChild(a) } catch {} }
    const exists = async (url: string): Promise<boolean> => { try { const res = await fetch(url, { method: 'HEAD' }); return res.ok } catch { return false } }
    if (os === 'unknown') {
      if (window.confirm('Download the UseClevr desktop helper for Windows?')) { if (await exists(targets.windows)) trigger(targets.windows, 'UseClevr-Hybrid-Runtime-Setup.exe'); else setPullError('Desktop helper not available for this platform.'); return }
      if (window.confirm('Download the UseClevr desktop helper for macOS?')) { if (await exists(targets.mac)) trigger(targets.mac, 'UseClevr-Hybrid-Runtime.dmg'); else setPullError('Desktop helper not available for this platform.'); return }
      if (window.confirm('Download the UseClevr desktop helper for Linux?')) { if (await exists(targets.linux)) trigger(targets.linux, 'UseClevr-Hybrid-Runtime.AppImage'); else setPullError('Desktop helper not available for this platform.'); return }
      return
    }
    const mapName: Record<Exclude<OS, 'unknown'>, string> = { windows: 'UseClevr-Hybrid-Runtime-Setup.exe', mac: 'UseClevr-Hybrid-Runtime.dmg', linux: 'UseClevr-Hybrid-Runtime.AppImage' }
    if (await exists(targets[os])) trigger(targets[os], mapName[os]); else setPullError('Desktop helper not available for this platform.')
  }, [])

  const handleVerify = async () => {
    if (selectedTier !== 'lite' && selectedTier !== 'mega') return
    setVerifyError(null)
    if (tierStatus[selectedTier] !== 'ready') return
    try {
      const statusRes = await fetch('/api/local-ai-status')
      if (!statusRes.ok) { setTierStatus(prev => ({ ...prev, [selectedTier]: 'error' })); return }
      const statusData: { available: boolean } = await statusRes.json()
      if (!statusData.available) { setTierStatus(prev => ({ ...prev, [selectedTier]: 'unavailable' })); return }
      setTierStatus(prev => ({ ...prev, [selectedTier]: 'verifying' }))
      const model = tierToModel[selectedTier]
      const res = await fetch('/api/ollama/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) })
      if (!res.ok) { await res.json().catch(() => ({})); setVerifyError('Verification failed'); setTierStatus(prev => ({ ...prev, [selectedTier]: 'error' })); return }
      setTierStatus(prev => ({ ...prev, [selectedTier]: 'verified' }))
    } catch { setVerifyError('Verification failed'); setTierStatus(prev => ({ ...prev, [selectedTier!]: 'error' })) }
  }

  const handleActivate = () => {
    if (selectedTier !== 'lite' && selectedTier !== 'mega') return
    if (tierStatus[selectedTier] !== 'verified') return
    try { document.cookie = `useclevr_hybrid=verified; path=/; max-age=86400`; setActivated(true) } catch {}
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={state === 'completed' ?
        (selectedTier === 'lite' ? 'Hybrid AI Lite' : selectedTier === 'mega' ? 'Hybrid AI MEGA' : 'Hybrid AI') + ' installed' :
        'Set up Hybrid AI'}
      description={state === 'completed' ? 'Hybrid mode active' : 'Choose the private analysis option included with your plan.'}
      showCloseButton={!['downloading', 'paused'].includes(state)}
    >
      {state === 'completed' ? (
        <div className="text-center py-8">
          <div className="text-green-500 text-5xl mb-4">✓</div>
          <p className="text-muted-foreground">Hybrid mode active</p>
        </div>
      ) : state === 'idle' ? (
        <>
          <p className="mb-6 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Your files stay on your device when Hybrid AI is active. Pro includes Lite. Business includes MEGA.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {visibleTierOptions.map((tier) => (
              <button key={tier.id} onClick={() => handleSelectTier(tier.id)} disabled={!tier.enabled}
                className={`w-full text-left p-4 rounded-lg border transition-all ${tier.enabled
                  ? `${selectedTier === tier.id ? 'border-slate-950 bg-slate-100 dark:border-white dark:bg-slate-900' : 'border-border hover:border-slate-400 hover:bg-muted'} cursor-pointer`
                  : 'border-border/50 opacity-60 cursor-not-allowed'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{tier.name}</span>
                      {tier.badge && <span className={`text-xs px-2 py-0.5 rounded-full ${tier.id === 'lite' ? 'bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100' : tier.id === 'mega' ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100' : 'bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100'}`}>{tier.badge}</span>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{tier.description}</p>
                    <p className="text-xs text-muted-foreground/70 mt-2">Approx. download: {tier.size}</p>
                  </div>
                  {selectedTier === tier.id && (tier.id === 'lite' || tier.id === 'mega') && (
                    (() => { const s = tierStatus[tier.id as TierId]; const branded = getBrandedStatus(s); return <span className={`ml-3 self-start text-xs px-2 py-0.5 rounded-full ${branded.className}`}>{branded.label}</span> })()
                  )}
                </div>
              </button>
            ))}
          </div>
          {(selectedTier === 'lite' || selectedTier === 'mega') && (
            <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3 md:flex-row md:items-center md:justify-between">
              {(() => { const branded = getBrandedStatus(tierStatus[selectedTier]); return <div className="text-xs text-muted-foreground">{branded.label}</div> })()}
              {tierStatus[selectedTier] === 'unavailable' && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={handleDownloadRuntime} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90"><Download className="mr-2 h-4 w-4" />Download desktop helper</Button>
                </div>
              )}
              {tierStatus[selectedTier] === 'installing_runtime' && (<span className="text-xs px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-950 dark:bg-cyan-950 dark:text-cyan-100">Preparing Hybrid AI</span>)}
              {tierStatus[selectedTier] === 'missing_model' && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={handlePull} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90"><Download className="mr-2 h-4 w-4" />Download Hybrid AI</Button>
                </div>
              )}
              {tierStatus[selectedTier] === 'downloading' && (<span className="text-xs px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-950 dark:bg-cyan-950 dark:text-cyan-100">Downloading Hybrid AI</span>)}
              {tierStatus[selectedTier] === 'ready' && (<Button onClick={handleVerify} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">Check setup</Button>)}
              {tierStatus[selectedTier] === 'verifying' && (<span className="text-xs px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-950 dark:bg-cyan-950 dark:text-cyan-100">Checking setup</span>)}
              {tierStatus[selectedTier] === 'verified' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100">Ready for private analysis</span>
                  {!activated ? (<Button onClick={handleActivate} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">Activate Hybrid AI</Button>) : (<span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100">Hybrid AI active</span>)}
                </div>
              )}
              {activated && tierStatus[selectedTier] === 'unavailable' && (<span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100">Desktop helper needed</span>)}
              {tierStatus[selectedTier] === 'error' && (
                <Button onClick={() => { if (selectedTier === 'lite' || selectedTier === 'mega') checkModelStatus(selectedTier) }} size="sm" className="bg-red-600 hover:bg-red-700">Retry</Button>
              )}
            </div>
          )}
          {pullError && <div className="mt-2 text-xs text-red-400">{pullError}</div>}
          {verifyError && <div className="mt-2 text-xs text-red-400">{verifyError}</div>}
        </>
      ) : (
        <>
          <h2 className="text-xl font-semibold mb-2">Install {selectedTier === 'lite' ? 'Hybrid AI Lite' : selectedTier === 'mega' ? 'Hybrid AI MEGA' : 'Hybrid AI'}</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {selectedTier === 'lite' ? "Fast setup for everyday private analysis." : selectedTier === 'mega' ? "Higher-capacity setup for business workstations." : "Download and install Hybrid AI."}
            <br />
            {selectedTier === 'lite' && "~2GB download • Estimated 3-5 minutes"}
            {selectedTier === 'mega' && "~5GB download • Estimated 8-15 minutes"}
          </p>
          {(state === 'downloading' || state === 'paused' || state === 'resuming') && (
            <div className="mb-6 space-y-3">
              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Step {step + 1}: {stepNames[step]}</span><span className="text-muted-foreground">{percentage}%</span></div>
              <div className="h-3 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${percentage}%` }} /></div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground">Downloaded</p><p className="font-medium">{formatBytes(progress.downloaded)} / {formatBytes(progress.total)}</p></div>
                <div><p className="text-muted-foreground">Speed / ETA</p><p className="font-medium">{formatBytes(progress.speed)}/s • {formatTime(progress.eta)} remaining</p></div>
              </div>
              <div className="flex items-center justify-center">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${state === 'downloading' ? 'bg-cyan-100 text-cyan-950 dark:bg-cyan-950 dark:text-cyan-100' : state === 'paused' ? 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100' : state === 'resuming' ? 'bg-violet-100 text-violet-950 dark:bg-violet-950 dark:text-violet-100' : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-100'}`}>
                  {state === 'downloading' && '⬇️ Downloading'}{state === 'paused' && '⏸️ Paused'}{state === 'resuming' && '⏳ Resuming...'}
                </span>
              </div>
            </div>
          )}
          {error && state === 'error' && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-md"><p className="text-sm text-red-400 whitespace-pre-wrap">{error}</p></div>
          )}
          <div className="flex gap-3">
            {state === 'idle' || state === 'error' ? (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
                <Button onClick={handleStart} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">{state === 'error' ? 'Retry Install' : 'Start Install'}</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleCancel} className="flex-1">Cancel</Button>
                {state === 'downloading' ? (<Button onClick={handlePause} className="flex-1 bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-400">⏸️ Pause</Button>)
                  : state === 'paused' ? (<Button onClick={handleResume} className="flex-1 bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400">▶️ Resume</Button>)
                  : (<Button disabled className="flex-1">{state === 'resuming' ? 'Resuming...' : 'Please wait...'}</Button>)}
              </>
            )}
          </div>
          {state === 'idle' && (
            <div className="mt-6 space-y-3">
              {stepNames.map((name, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${idx <= step ? 'bg-primary/15 text-primary dark:text-cyan-100' : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-100'}`}>{idx < step ? '✓' : idx + 1}</div>
                  <p className={`text-sm ${idx <= step ? '' : 'text-muted-foreground'}`}>{name}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
