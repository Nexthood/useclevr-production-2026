"use client"

import { submitContactRequest } from "@/app/actions/contact"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle2, Loader2, Mail } from "lucide-react"
import { useState, useTransition } from "react"

export function ContactRequestForm() {
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <form
      className="space-y-5"
      action={(formData) => {
        setError(null)
        setMessage(null)
        startTransition(async () => {
          const result = await submitContactRequest(formData)
          if (result?.error) {
            setError(result.error)
            return
          }
          setMessage("Thanks. We received your request and will follow up by email.")
        })
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-name">Name</Label>
          <Input id="contact-name" name="name" autoComplete="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-email">Email</Label>
          <Input id="contact-email" name="email" type="email" autoComplete="email" required />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-company">Company</Label>
          <Input id="contact-company" name="company" autoComplete="organization" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-type">Request</Label>
          <select
            id="contact-type"
            name="requestType"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            defaultValue="Demo request"
          >
            <option>Demo request</option>
            <option>Sales question</option>
            <option>Support question</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-message">Message</Label>
        <textarea
          id="contact-message"
          name="message"
          rows={5}
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Tell us what you want to analyze, who will use it, or what you want to see in a demo."
        />
      </div>

      {message && (
        <p className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-100">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-100">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" disabled={isPending} className="gap-2">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Request demo
        </Button>
        <a href="mailto:contact@useclevr.com" className="text-sm font-medium text-primary hover:underline">
          contact@useclevr.com
        </a>
      </div>
    </form>
  )
}
