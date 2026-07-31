"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

type ProfileDebugPanelProps = {
  userId: string | null
  organizationId: string | null
  profileApiUrl: string
  serverProfileObject: unknown
  normalizedProfileObject: unknown
  deployedCommitHash: string
}

type ProfileFetchState = {
  status: "loading" | "success" | "error"
  httpStatus: number | null
  response: unknown
  error: string | null
}

export function AccountancyProfileDebugPanel({
  userId,
  organizationId,
  profileApiUrl,
  serverProfileObject,
  normalizedProfileObject,
  deployedCommitHash,
}: ProfileDebugPanelProps) {
  const pathname = usePathname()
  const [state, setState] = useState<ProfileFetchState>({
    status: "loading",
    httpStatus: null,
    response: null,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      setState({ status: "loading", httpStatus: null, response: null, error: null })
      try {
        const response = await fetch(profileApiUrl, {
          cache: "no-store",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        })
        const text = await response.text()
        let parsed: unknown = text
        try {
          parsed = text ? JSON.parse(text) : null
        } catch {
          parsed = text
        }
        if (!cancelled) {
          setState({
            status: response.ok ? "success" : "error",
            httpStatus: response.status,
            response: parsed,
            error: response.ok ? null : response.statusText || "Request failed",
          })
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            httpStatus: null,
            response: null,
            error: error instanceof Error ? error.message : "Profile request failed",
          })
        }
      }
    }

    loadProfile()
    return () => {
      cancelled = true
    }
  }, [profileApiUrl])

  return (
    <section className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-foreground">
      <div className="mb-3">
        <h2 className="text-sm font-semibold">Business Profile runtime diagnostics</h2>
        <p className="mt-1 text-muted-foreground">
          Temporary diagnostic panel. Remove after the Accountancy profile values are verified in the deployed app.
        </p>
      </div>
      <dl className="grid gap-2 md:grid-cols-2">
        <DebugItem label="Current route" value={pathname} />
        <DebugItem label="Authenticated user ID" value={userId || "null"} />
        <DebugItem label="Organization/workspace ID" value={organizationId || "null"} />
        <DebugItem label="Profile API URL called" value={profileApiUrl} />
        <DebugItem label="HTTP status" value={state.httpStatus === null ? state.status : `${state.httpStatus} (${state.status})`} />
        <DebugItem label="Deployed commit hash" value={deployedCommitHash} />
      </dl>
      {state.status === "loading" && (
        <p className="mt-3 rounded-md border border-border bg-background p-3 font-medium">Loading profile...</p>
      )}
      {state.status === "error" && (
        <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 font-medium text-destructive">
          Could not load Business Profile: {state.error}
        </p>
      )}
      <DebugJson title="Raw returned profile object from browser API" value={state.response} />
      <DebugJson title="Server-loaded Business Profile object used by Accountancy" value={serverProfileObject} />
      <DebugJson title="Normalized Accountancy profile object" value={normalizedProfileObject} />
    </section>
  )
}

function DebugItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-2">
      <dt className="font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-all font-mono">{value}</dd>
    </div>
  )
}

function DebugJson({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="mt-3 rounded-md border border-border bg-background p-3" open>
      <summary className="cursor-pointer font-medium">{title}</summary>
      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  )
}
