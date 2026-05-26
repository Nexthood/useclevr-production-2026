"use client"

import { updateBusinessDetails } from "@/app/actions/settings"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useNotice } from "@/components/ui/notice-bar"
import { BUSINESS_FIELDS, getBusinessCompletionPercent, getBusinessReviewFlags, type BusinessDetails } from "@/lib/business/business-profile"
import { AlertCircle, Building2, CheckCircle2, Mail, MapPin, Percent, Save } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"

export function BusinessProfileForm() {
  const router = useRouter()
  const { showNotice } = useNotice()
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
      try {
        const res = await fetch("/api/me/business", { cache: "no-store" })
        if (res.ok) {
          const data = await res.json()
          if (data.details && !cancelled) {
            setDetails({
              businessName: data.details.businessName || "",
              businessEmail: data.details.businessEmail || "",
              industry: data.details.industry || "",
              location: data.details.location || "",
              website: data.details.website || "",
              businessDescription: data.details.businessDescription || "",
            })
          }
        }
      } catch {
        // The form remains editable when profile details cannot be preloaded.
      }
    })()

    return () => {
      cancelled = true
    }
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

  const pct = getBusinessCompletionPercent(details)
  const flags = getBusinessReviewFlags(details)
  const sections = Array.from(new Set(BUSINESS_FIELDS.map((field) => field.section)))

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border bg-card lg:col-span-2">
          <CardHeader>
            <CardTitle>Business profile</CardTitle>
            <CardDescription>
              Complete these fields once so analysis, reports, and support context use the same company details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <ProfileMetric
                icon={Building2}
                label="Identity"
                value={`${BUSINESS_FIELDS.filter((field) => field.section === "Identity" && details[field.id]).length}/3`}
              />
              <ProfileMetric
                icon={Mail}
                label="Contact"
                value={`${BUSINESS_FIELDS.filter((field) => field.section === "Contact" && details[field.id]).length}/2`}
              />
              <ProfileMetric
                icon={MapPin}
                label="Operations"
                value={`${BUSINESS_FIELDS.filter((field) => field.section === "Operations" && details[field.id]).length}/1`}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Review</CardTitle>
            <CardDescription>Flags that affect AI confidence.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {flags.map((flag) => (
              <div key={flag.label} className="flex gap-2 text-sm">
                {flag.complete ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                )}
                <div>
                  <p className="font-medium text-foreground">{flag.label}</p>
                  <p className="text-muted-foreground">{flag.complete ? "Ready" : flag.help}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

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
          <div className="mb-6 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Percent className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">Profile completion</p>
              <p className="text-lg font-semibold">{pct === 0 ? "0% - not started" : `${pct}%`}</p>
            </div>
            <div className="ml-auto max-w-xs flex-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {sections.map((section) => (
              <div key={section} className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{section}</h3>
                  <p className="text-sm text-muted-foreground">
                    {section === "Identity" && "Describe what the company is and how it should appear in reports."}
                    {section === "Contact" && "Add customer-facing contact details for reports and support context."}
                    {section === "Operations" && "Add the main operating location for regional assumptions."}
                  </p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {BUSINESS_FIELDS.filter((field) => field.section === section).map((field) => (
                    <div key={field.id} className={field.type === "textarea" ? "space-y-1.5 lg:col-span-2" : "space-y-1.5"}>
                      <Label htmlFor={field.id}>{field.label}</Label>
                      {field.type === "textarea" ? (
                        <textarea
                          id={field.id}
                          name={field.id}
                          placeholder={field.placeholder}
                          rows={4}
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
                </div>
              </div>
            ))}
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : "Save business details"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function ProfileMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium text-foreground">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold text-primary">{value}</p>
    </div>
  )
}
