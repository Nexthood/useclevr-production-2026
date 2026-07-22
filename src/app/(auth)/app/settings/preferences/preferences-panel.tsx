"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useNotice } from "@/components/ui/notice-bar"
import {
  dateFormatOptions,
  detectBrowserLocale,
  detectBrowserTimezone,
  formatCurrencyWithPreferences,
  formatDateWithPreferences,
  formatNumberWithPreferences,
  languageOptions,
  manualCurrencies,
  normalizeRegionalPreferences,
  numberFormatOptions,
  resolveDisplayCurrency,
  resolveTimezone,
  supportedCurrencies,
  timezoneOptions,
  type RegionalPreferences,
} from "@/lib/utils/regional-preferences"
import { useFormatting } from "@/lib/utils/formatting-context"
import { Globe, Info } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"

type PreferencesPanelProps = {
  initialPreferences: RegionalPreferences
  loadError?: string | null
}

const sampleValue = 1116800
const sampleDate = new Date(Date.UTC(2026, 6, 21, 12, 0, 0))

export function PreferencesPanel({ initialPreferences, loadError }: PreferencesPanelProps) {
  const router = useRouter()
  const { showNotice } = useNotice()
  const { setPreferences } = useFormatting()
  const [preferences, setRegionalPreferences] = React.useState<RegionalPreferences>(initialPreferences)
  const [browserLocale, setBrowserLocale] = React.useState<string | null>(null)
  const [browserTimezone, setBrowserTimezone] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(loadError ?? null)

  React.useEffect(() => {
    setBrowserLocale(detectBrowserLocale())
    setBrowserTimezone(detectBrowserTimezone())
  }, [])

  React.useEffect(() => {
    if (!loadError) return
    showNotice({
      type: "error",
      title: "Preferences loaded partially.",
      message: loadError,
    })
  }, [loadError, showNotice])

  const resolvedDisplayCurrency = resolveDisplayCurrency(preferences, browserLocale)
  const resolvedTimezone = resolveTimezone(preferences, browserTimezone)
  const previewCurrency = formatCurrencyWithPreferences(sampleValue, preferences, browserLocale)
  const previewNumber = formatNumberWithPreferences(sampleValue, preferences, browserLocale)
  const previewDate = formatDateWithPreferences(sampleDate, preferences, browserLocale)

  const updatePreference = <Key extends keyof RegionalPreferences>(key: Key, value: RegionalPreferences[Key]) => {
    setRegionalPreferences((current) => ({ ...current, [key]: value }))
    setSaveError(null)
  }

  const handleSaveFormatting = async () => {
    setIsSaving(true)
    setSaveError(null)

    try {
      const response = await fetch("/api/settings/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...preferences, browserLocale }),
      })
      const payload = await response.json().catch(() => null) as { success?: boolean; error?: string; preferences?: RegionalPreferences } | null

      if (!response.ok || !payload?.success || !payload.preferences) {
        throw new Error(payload?.error || "Regional preferences were not saved.")
      }

      const normalized = normalizeRegionalPreferences(payload.preferences)
      setRegionalPreferences(normalized)
      setPreferences({
        ...normalized,
        preferredCurrency: normalized.displayCurrency,
        baseCurrency: normalized.baseCurrency,
        numberFormat: normalized.numberFormat,
      })
      showNotice({ type: "success", title: "Regional preferences saved." })
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Regional preferences were not saved."
      setSaveError(message)
      showNotice({ type: "error", title: "Preferences were not saved.", message })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500">
            <Globe className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-foreground">Regional Preferences</CardTitle>
            <CardDescription className="text-muted-foreground">
              Configure language, currency, number, date and timezone settings.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {saveError && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
            {saveError}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <SelectField
            id="displayCurrency"
            label="Display currency"
            value={preferences.displayCurrency}
            options={supportedCurrencies}
            onChange={(value) => updatePreference("displayCurrency", value as RegionalPreferences["displayCurrency"])}
          />

          <SelectField
            id="baseCurrency"
            label="Base currency"
            value={preferences.baseCurrency}
            options={manualCurrencies}
            onChange={(value) => updatePreference("baseCurrency", value as RegionalPreferences["baseCurrency"])}
          />

          <SelectField
            id="numberFormat"
            label="Number format"
            value={preferences.numberFormat}
            options={numberFormatOptions}
            onChange={(value) => updatePreference("numberFormat", value as RegionalPreferences["numberFormat"])}
          />

          <SelectField
            id="dateFormat"
            label="Date format"
            value={preferences.dateFormat}
            options={dateFormatOptions}
            onChange={(value) => updatePreference("dateFormat", value as RegionalPreferences["dateFormat"])}
          />

          <SelectField
            id="timezone"
            label="Timezone"
            value={preferences.timezone}
            options={timezoneOptions}
            onChange={(value) => updatePreference("timezone", value as RegionalPreferences["timezone"])}
          />

          <SelectField
            id="language"
            label="Language"
            value={preferences.language}
            options={languageOptions}
            onChange={(value) => updatePreference("language", value as RegionalPreferences["language"])}
          />
        </div>

        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-950 dark:text-blue-100">
          <div className="flex gap-3">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">Display currency controls formatting only.</p>
              <p className="text-blue-900/80 dark:text-blue-100/80">
                Base Currency remains the accounting currency used for calculations. UseClevr does not convert financial values here unless a real exchange-rate conversion flow is explicitly used.
              </p>
              <p className="text-blue-900/80 dark:text-blue-100/80">
                Language preference is saved for supported areas and does not imply the whole application is translated.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-muted p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">Preview</p>
            <p className="text-xs text-muted-foreground">
              Locale: {browserLocale || "Detecting"} · Display: {resolvedDisplayCurrency}
            </p>
          </div>
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <PreviewLine label="Currency" value={previewCurrency} />
            <PreviewLine label="Number" value={previewNumber} />
            <PreviewLine label="Date" value={previewDate} />
            <PreviewLine label="Timezone" value={resolvedTimezone} />
          </div>
        </div>

        <Button onClick={handleSaveFormatting} disabled={isSaving} className="bg-gradient-primary hover:opacity-90">
          {isSaving ? "Saving settings..." : "Save settings"}
        </Button>
      </CardContent>
    </Card>
  )
}

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-foreground">{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-md border border-input bg-muted px-3 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  )
}

function PreviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-mono text-foreground">{value}</p>
    </div>
  )
}

