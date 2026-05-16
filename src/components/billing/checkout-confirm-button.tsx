"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CheckoutConfirmButton({ planId }: { planId: string }) {
  const [isSaving, setIsSaving] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)

  const confirm = async () => {
    setIsSaving(true)
    setMessage(null)
    try {
      const response = await fetch("/api/checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      })
      const result = await response.json()
      setMessage(result.message || (response.ok ? "Checkout review saved." : "Checkout failed."))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={confirm} disabled={isSaving} className="w-full">
        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save checkout review
      </Button>
      {message && <p className="text-center text-sm text-muted-foreground">{message}</p>}
    </div>
  )
}
