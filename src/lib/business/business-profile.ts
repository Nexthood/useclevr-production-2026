export type BusinessDetails = {
  businessName: string
  businessEmail: string
  industry: string
  location: string
  website: string
  businessDescription: string
}

export const BUSINESS_FIELDS: { id: keyof BusinessDetails; label: string; placeholder: string; type?: string; section: string }[] = [
  { id: "businessName", label: "Company name", placeholder: "Acme Corp", section: "Identity" },
  { id: "industry", label: "Industry", placeholder: "Technology", section: "Identity" },
  {
    id: "businessDescription",
    label: "Business description",
    placeholder: "Brief description of what your company does",
    type: "textarea",
    section: "Identity",
  },
  { id: "businessEmail", label: "Company email", placeholder: "contact@acme.com", type: "email", section: "Contact" },
  { id: "website", label: "Website", placeholder: "https://acme.com", type: "url", section: "Contact" },
  { id: "location", label: "Location", placeholder: "Copenhagen, Denmark", section: "Operations" },
]

export function getBusinessCompletionPercent(details: BusinessDetails): number {
  const filled = BUSINESS_FIELDS.filter((field) => String(details[field.id] || "").trim().length > 0).length
  return Math.round((filled / BUSINESS_FIELDS.length) * 100)
}

export function getBusinessReviewFlags(details: BusinessDetails) {
  return [
    {
      label: "Business identity",
      complete: Boolean(details.businessName.trim() && details.industry.trim()),
      help: "Add a company name and industry so reports use the right business context.",
    },
    {
      label: "Contact details",
      complete: Boolean(details.businessEmail.includes("@") && details.website.trim()),
      help: "Add a company email and website for support, reports, and future customer-facing outputs.",
    },
    {
      label: "Operating location",
      complete: Boolean(details.location.trim()),
      help: "Add the primary location so currency, tax, and region assumptions can be reviewed.",
    },
    {
      label: "Analysis context",
      complete: details.businessDescription.trim().length >= 40,
      help: "Add a short description with what the company sells, who it serves, and how it earns revenue.",
    },
  ]
}
