"use client"

import * as React from "react"
import { ArrowLeft, User, CreditCard, Bell, Shield, Trash2, Download, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"
import Link from "next/link"
import { useFormatting } from "@/lib/formatting-context"
import { formatCurrency, formatNumber } from "@/lib/formatting"

export default function SettingsPage() {
  const { preferences, setPreferences } = useFormatting()
  const [currency, setCurrency] = React.useState(preferences.preferredCurrency)
  const [baseCurrency, setBaseCurrency] = React.useState(preferences.baseCurrency)
  const [numberFormat, setNumberFormat] = React.useState<string>(preferences.numberFormat)
  const [testValue, setTestValue] = React.useState(1116800.00)

  const handleSaveFormatting = () => {
    setPreferences({
      ...preferences,
      preferredCurrency: currency,
      baseCurrency: baseCurrency,
      numberFormat: numberFormat as 'auto' | 'manual',
    })
  }

  return (
    <div className="min-h-screen bg-background pl-10">
      {/* Header */}
      <header className="border-b border-border bg-card h-16">
        <div className="flex h-16 items-center justify-between px-6 gap-4">
          <div className="flex items-center gap-4">
            <Link href="/app">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-2xl mx-auto space-y-8 pt-8">
          {/* Profile Section */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-foreground">Profile</CardTitle>
                  <CardDescription className="text-muted-foreground">Manage your personal information</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-foreground">First name</Label>
                  <Input id="firstName" defaultValue="Demo" className="bg-muted border-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-foreground">Last name</Label>
                  <Input id="lastName" defaultValue="User" className="bg-muted border-input" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">Email</Label>
                <Input id="email" type="email" defaultValue="demo@useclever.app" className="bg-muted border-input" />
              </div>
              <Button className="bg-gradient-primary hover:opacity-90">Save Changes</Button>
            </CardContent>
          </Card>

          {/* Subscription Section */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-foreground">Subscription</CardTitle>
                  <CardDescription className="text-muted-foreground">Manage your subscription and billing</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                <div>
                  <p className="font-medium text-foreground">Current Plan</p>
                  <p className="text-sm text-muted-foreground">Free Tier - Forever free</p>
                </div>
                <Link href="/pricing">
                  <Button variant="outline" size="sm">Upgrade</Button>
                </Link>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                <div>
                  <p className="font-medium text-foreground">Credits Used</p>
                  <p className="text-sm text-muted-foreground">0 of 5 credits this month</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Regional Settings Section */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-foreground">Regional Settings</CardTitle>
                  <CardDescription className="text-muted-foreground">Configure currency and number formatting for international use. Set base currency for multi-currency dataset conversions.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Currency Selector */}
              <div className="space-y-2">
                <Label htmlFor="currency" className="text-foreground">Display Currency</Label>
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
                <p className="text-sm text-muted-foreground">Currency for financial displays</p>
              </div>

              {/* Base Currency Selector */}
              <div className="space-y-2">
                <Label htmlFor="baseCurrency" className="text-foreground">Base Currency (for conversions)</Label>
                <select
                  id="baseCurrency"
                  value={baseCurrency}
                  onChange={(e) => setBaseCurrency(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-muted text-foreground"
                >
                  <option value="USD">USD - US Dollar (Default)</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="JPY">JPY - Japanese Yen</option>
                  <option value="CAD">CAD - Canadian Dollar</option>
                  <option value="AUD">AUD - Australian Dollar</option>
                  <option value="CHF">CHF - Swiss Franc</option>
                </select>
                <p className="text-sm text-muted-foreground">Base currency for multi-currency dataset conversion</p>
              </div>

              {/* Number Format */}
              <div className="space-y-2">
                <Label htmlFor="numberFormat" className="text-foreground">Number Format</Label>
                <select
                  id="numberFormat"
                  value={numberFormat}
                  onChange={(e) => setNumberFormat(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-muted text-foreground"
                >
                  <option value="auto">Auto (Browser Language)</option>
                  <option value="manual">Manual</option>
                </select>
                <p className="text-sm text-muted-foreground">Auto uses your browser's language setting</p>
              </div>

              {/* Preview */}
              <div className="p-4 rounded-lg bg-muted space-y-2">
                <p className="text-sm font-medium text-foreground">Preview</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Currency:</p>
                    <p className="text-foreground font-mono">
                      {formatCurrency(testValue, { preferredCurrency: currency, baseCurrency: baseCurrency, numberFormat: numberFormat as 'auto' | 'manual' }, currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Number:</p>
                    <p className="text-foreground font-mono">
                      {formatNumber(testValue, { preferredCurrency: currency, baseCurrency: baseCurrency, numberFormat: numberFormat as 'auto' | 'manual' })}
                    </p>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleSaveFormatting}
                className="bg-gradient-primary hover:opacity-90"
              >
                Save Formatting Preferences
              </Button>
            </CardContent>
          </Card>

          {/* Notifications Section */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-foreground">Notifications</CardTitle>
                  <CardDescription className="text-muted-foreground">Configure how you receive notifications</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive updates via email</p>
                </div>
                <Button variant="outline" size="sm">Enabled</Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Analysis Complete</p>
                  <p className="text-sm text-muted-foreground">Notify when dataset analysis is ready</p>
                </div>
                <Button variant="outline" size="sm">Enabled</Button>
              </div>
            </CardContent>
          </Card>

          {/* Security Section */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-foreground">Security</CardTitle>
                  <CardDescription className="text-muted-foreground">Manage your account security</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                </div>
                <Button variant="outline" size="sm">Enable</Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Change Password</p>
                  <p className="text-sm text-muted-foreground">Update your password regularly</p>
                </div>
                <Button variant="outline" size="sm">Update</Button>
              </div>
            </CardContent>
          </Card>

          {/* Data & Privacy Section */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Download className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-foreground">Data & Privacy</CardTitle>
                  <CardDescription className="text-muted-foreground">Control your data and privacy settings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Export Data</p>
                  <p className="text-sm text-muted-foreground">Download all your data in CSV format</p>
                </div>
                <Button variant="outline" size="sm">Export</Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Delete All Data</p>
                  <p className="text-sm text-muted-foreground">Permanently delete all your datasets and analysis</p>
                </div>
                <Button variant="destructive" size="sm">Delete All</Button>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="bg-card border-red-900/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <CardTitle className="text-red-500">Danger Zone</CardTitle>
                  <CardDescription className="text-muted-foreground">Irreversible and destructive actions</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                <div>
                  <p className="font-medium text-red-500">Delete Account</p>
                  <p className="text-sm text-muted-foreground">Permanently delete your account and all associated data</p>
                </div>
                <Button variant="destructive" size="sm">Delete Account</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
