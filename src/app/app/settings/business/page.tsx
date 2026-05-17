"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { updateBusinessDetails } from "@/app/actions/settings"
import { Building2, Info, Percent, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useNotice } from "@/components/ui/notice-bar"
import { auth } from "@/lib/auth"

type BusinessDetails = {
  businessName: string
  businessEmail: string
  industry: string
  location: string
  website: string
  businessDescription: string
}

const FIELDS: { id: keyof BusinessDetails; label: string; placeholder: string; type?: string }[] = [
  { id: "businessName",        label: "Company name",    placeholder: "Acme Corp" },
  { id: "businessEmail",       label: "Company email",   placeholder: "contact@acme.com", type: "email" },
  { id: "industry",            label: "Industry",        placeholder: "Technology" },
  { id: "location",            label: "Location",        placeholder: "Copenhagen, Denmark" },
  { id: "website",             label: "Website",         placeholder: "https://acme.com", type: "url" },
  { id: "businessDescription", label: "Business description", placeholder: "Brief description of what your company does", type: "textarea" },
]

function completionPercent(details: BusinessDetails): number {
  const filled = FIELDS.filter((f) => {
    const v = String(details[f.id] || "").trim()
    return v.length > 0
  }).length
  return Math.round((filled / FIELDS.length) * 100)
}

export default function BusinessSettingsPage() {
  const router = useRouter()
  const { showNotice } = useNotice()
  const [isLoading, setIsLoading] = React.useState(true)
  const [details, setDetails] = React.useState<BusinessDetails>({
    businessName: "",
    businessEmail: "",
    industry: "",
    location: "",
    website: "",
    businessDescription: "",
  })
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      const session = await auth()
      if (!cancelled && session?.user?.id) {
        try {
          const res = await fetch("/api/me/business", { cache: "no-store" })
          if (res.ok) {
            const data = await res.json()
            if (data.details && !cancelled) {
              setDetails({
                businessName:        data.details.businessName ||        "",
                businessEmail:       data.details.businessEmail ||       "",
                industry:            data.details.industry ||            "",
                location:            data.details.location ||            "",
                website:             data.details.website ||             "",
                businessDescription: data.details.businessDescription || "",
              })
            }
          }
        } catch { /* best effort */ }
      }
      if (!cancelled) setIsLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const handleChange = (id: keyof BusinessDetails, value: string) => {
    setDetails((prev) => ({ ...prev, [id]: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)

    const result = await updateBusinessDetails(new FormData(event.currentTarget))

    if (result.error) {
      showNotice({ type: "error", title: "Not saved.", message: result.error })
    } else {
      showNotice({ type: "success", title: result.message || "Business details saved." })
      router.refresh()
    }
    setIsSaving(false)
  }

  const pct = completionPercent(details)

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Business details</CardTitle>
              <CardDescription>Help us tailor suggestions and enable advanced features.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Percent className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">Profile completion</p>
              <p className="text-lg font-semibold">{pct === 0 ? "0% — not started" : `${pct}%`}</p>
            </div>
            <div className="ml-auto flex-1 max-w-xs">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {FIELDS.map((field) => (
              <div key={field.id} className="space-y-1.5">
                <Label htmlFor={field.id}>
                  {field.label}
                </Label>
                {field.type === "textarea" ? (
                  <textarea
                    id={field.id}
                    name={field.id}
                    placeholder={field.placeholder}
                    rows={3}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={details[field.id]}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                  />
                ) : (
                  <Input
                    id={field.id}
                    name={field.id}
                    type={field.type ?? "text"}
                    placeholder={field.placeholder}
                    value={details[field.id]}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                  />
                )}
              </div>
            ))}
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving…" : "Save business details"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
