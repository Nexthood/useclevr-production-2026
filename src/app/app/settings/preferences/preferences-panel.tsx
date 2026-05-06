"use client"

import * as React from "react"
import { Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useNotice } from "@/components/ui/notice-bar"
import { useFormatting } from "@/lib/formatting-context"
import { formatCurrency, formatNumber } from "@/lib/formatting"

export function PreferencesPanel() {
  const { preferences, setPreferences } = useFormatting()
  const { showNotice } = useNotice()
  const [currency, setCurrency] = React.useState(preferences.preferredCurrency)
  const [baseCurrency, setBaseCurrency] = React.useState(preferences.baseCurrency)
  const [numberFormat, setNumberFormat] = React.useState<string>(preferences.numberFormat)
  const testValue = 1116800.00

  const handleSaveFormatting = () => {
    setPreferences({
      ...preferences,
      preferredCurrency: currency,
      baseCurrency,
      numberFormat: numberFormat as "auto" | "manual",
    })
    showNotice({ type: "success", title: "Settings saved." })
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
            <Globe className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-foreground">Settings</CardTitle>
            <CardDescription className="text-muted-foreground">Configure currency and number formatting.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="currency" className="text-foreground">Display currency</Label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-input bg-muted text-foreground"
          >
            <option value="EUR">EUR - Euro</option>
            <option value="USD">USD - US Dollar</option>
            <option value="GBP">GBP - British Pound</option>
            <option value="JPY">JPY - Japanese Yen</option>
            <option value="CHF">CHF - Swiss Franc</option>
            <option value="CAD">CAD - Canadian Dollar</option>
            <option value="AUD">AUD - Australian Dollar</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="baseCurrency" className="text-foreground">Base currency</Label>
          <select
            id="baseCurrency"
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-input bg-muted text-foreground"
          >
            <option value="USD">USD - US Dollar</option>
            <option value="EUR">EUR - Euro</option>
            <option value="GBP">GBP - British Pound</option>
            <option value="JPY">JPY - Japanese Yen</option>
            <option value="CAD">CAD - Canadian Dollar</option>
            <option value="AUD">AUD - Australian Dollar</option>
            <option value="CHF">CHF - Swiss Franc</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="numberFormat" className="text-foreground">Number format</Label>
          <select
            id="numberFormat"
            value={numberFormat}
            onChange={(e) => setNumberFormat(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-input bg-muted text-foreground"
          >
            <option value="auto">Auto</option>
            <option value="manual">Manual</option>
          </select>
        </div>

        <div className="p-4 rounded-lg bg-muted space-y-2">
          <p className="text-sm font-medium text-foreground">Preview</p>
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Currency</p>
              <p className="text-foreground font-mono">
                {formatCurrency(testValue, { preferredCurrency: currency, baseCurrency, numberFormat: numberFormat as "auto" | "manual" }, currency)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Number</p>
              <p className="text-foreground font-mono">
                {formatNumber(testValue, { preferredCurrency: currency, baseCurrency, numberFormat: numberFormat as "auto" | "manual" })}
              </p>
            </div>
          </div>
        </div>

        <Button onClick={handleSaveFormatting} className="bg-gradient-primary hover:opacity-90">
          Save settings
        </Button>
      </CardContent>
    </Card>
  )
}

