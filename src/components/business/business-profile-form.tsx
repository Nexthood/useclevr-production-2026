"use client"

import { updateBusinessDetails } from "@/app/actions/settings"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useNotice } from "@/components/ui/notice-bar"
import { BUSINESS_FIELDS, type BusinessDetails } from "@/lib/business/business-profile"
import { Building2, Save } from "lucide-react"
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

  const sections = Array.from(new Set(BUSINESS_FIELDS.map((field) => field.section)))

  return (
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
  )
}
