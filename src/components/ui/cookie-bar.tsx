"use client"

import { Button } from "@/components/ui/button"
import {
  getCookieConsent,
  setCookieConsent,
  type CookieConsentPreferences,
} from "@/lib/privacy/cookie-consent"
import { BarChart3, Check, Cookie, Settings2, ShieldCheck, Sparkles, X } from "lucide-react"
import Link from "next/link"
import * as React from "react"

export function CookieBar() {
  const [visible, setVisible] = React.useState(false)
  const [manageOpen, setManageOpen] = React.useState(false)
  const [analytics, setAnalytics] = React.useState(false)
  const [productImprovement, setProductImprovement] = React.useState(false)

  const saveConsent = React.useCallback((preferences: Pick<CookieConsentPreferences, "analytics" | "productImprovement">) => {
    const consent = setCookieConsent(preferences)
    setAnalytics(consent.analytics)
    setProductImprovement(consent.productImprovement)
    setManageOpen(false)
    setVisible(false)
  }, [])

  React.useEffect(() => {
    const consent = getCookieConsent()
    if (!consent) {
      if (window.localStorage.getItem("cookie-consent")) {
        saveConsent({ analytics: false, productImprovement: false })
        return
      }

      setVisible(true)
      return
    }

    setAnalytics(consent.analytics)
    setProductImprovement(consent.productImprovement)
  }, [saveConsent])

  if (!visible) return null

  return (
    <>
      <div className="fixed inset-x-3 bottom-3 z-[130] sm:inset-x-auto sm:bottom-5 sm:left-5 sm:max-w-[440px]">
        <section
          className="overflow-hidden rounded-3xl border border-cyan-200/20 bg-slate-950/92 text-white shadow-[0_24px_80px_rgba(2,6,23,0.45),0_0_34px_rgba(34,211,238,0.12)] backdrop-blur-2xl"
          aria-label="Cookie consent"
        >
          <div className="h-px bg-gradient-to-r from-cyan-200/70 via-fuchsia-200/70 to-transparent" />
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-200/10 text-cyan-100">
                <Cookie className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold tracking-tight">Cookie preferences</h2>
                <p className="mt-1 text-sm leading-6 text-slate-200/85">
                  We use essential cookies to keep UseClevr secure and working. Optional analytics
                  cookies help us improve the product.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-slate-300">
              <Link href="/privacy" className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 transition hover:border-cyan-200/50 hover:text-white">
                Privacy
              </Link>
              <Link href="/terms" className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 transition hover:border-cyan-200/50 hover:text-white">
                Terms
              </Link>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Button
                type="button"
                onClick={() => saveConsent({ analytics: true, productImprovement: true })}
                className="gap-2 rounded-full bg-gradient-to-r from-cyan-200 via-sky-200 to-fuchsia-200 text-slate-950 hover:opacity-95"
              >
                <Check className="h-4 w-4" />
                Accept all
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => saveConsent({ analytics: false, productImprovement: false })}
                className="rounded-full border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.1]"
              >
                Essential only
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setManageOpen(true)}
                className="gap-2 rounded-full text-cyan-100 hover:bg-cyan-200/10 hover:text-white"
              >
                <Settings2 className="h-4 w-4" />
                Manage
              </Button>
            </div>
          </div>
        </section>
      </div>

      {manageOpen && (
        <CookiePreferencesModal
          analytics={analytics}
          productImprovement={productImprovement}
          onAnalyticsChange={setAnalytics}
          onProductImprovementChange={setProductImprovement}
          onClose={() => setManageOpen(false)}
          onSave={() => saveConsent({ analytics, productImprovement })}
        />
      )}
    </>
  )
}

function CookiePreferencesModal({
  analytics,
  productImprovement,
  onAnalyticsChange,
  onProductImprovementChange,
  onClose,
  onSave,
}: {
  analytics: boolean
  productImprovement: boolean
  onAnalyticsChange: (value: boolean) => void
  onProductImprovementChange: (value: boolean) => void
  onClose: () => void
  onSave: () => void
}) {
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[140] flex items-end bg-slate-950/60 p-3 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-preferences-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className="w-full overflow-hidden rounded-3xl border border-cyan-200/20 bg-slate-950 text-white shadow-[0_30px_100px_rgba(2,6,23,0.55)] sm:max-w-lg">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.22),transparent_34%),radial-gradient(circle_at_86%_0%,rgba(216,180,254,0.18),transparent_34%)] px-5 py-4">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-xs font-medium text-cyan-100">
              <Sparkles className="h-3.5 w-3.5" />
              Global preferences
            </p>
            <h2 id="cookie-preferences-title" className="mt-3 text-lg font-semibold">
              Cookie preferences
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              Choose optional cookies now. You can keep using UseClevr either way.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/[0.06] p-2 text-white/70 transition hover:bg-white/[0.12] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            aria-label="Close cookie preferences"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <PreferenceRow
            icon={ShieldCheck}
            title="Essential cookies"
            description="Required for sign-in, security, preferences, and core product behavior."
            checked
            disabled
          />
          <PreferenceRow
            icon={BarChart3}
            title="Analytics cookies"
            description="Help UseClevr understand usage patterns and improve reliability."
            checked={analytics}
            onChange={onAnalyticsChange}
          />
          <PreferenceRow
            icon={Sparkles}
            title="Product improvement cookies"
            description="Help us learn which product flows are useful so we can improve onboarding and analysis."
            checked={productImprovement}
            onChange={onProductImprovementChange}
          />
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-white/10 px-5 py-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-full border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.1]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSave}
            className="rounded-full bg-gradient-to-r from-cyan-200 via-sky-200 to-fuchsia-200 text-slate-950 hover:opacity-95"
          >
            Save preferences
          </Button>
        </div>
      </section>
    </div>
  )
}

function PreferenceRow({
  icon: Icon,
  title,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange?: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <div className="flex min-w-0 gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-200/10 text-cyan-100">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-300">{description}</p>
        </div>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={[
          "relative h-7 w-12 shrink-0 rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
          checked ? "border-cyan-200/50 bg-cyan-200/70" : "border-white/15 bg-white/10",
          disabled ? "cursor-not-allowed opacity-80" : "hover:border-cyan-200/60",
        ].join(" ")}
        aria-pressed={checked}
        aria-label={`${title}: ${checked ? "on" : "off"}`}
      >
        <span
          className={[
            "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition",
            checked ? "left-6" : "left-1",
          ].join(" ")}
        />
      </button>
    </div>
  )
}
