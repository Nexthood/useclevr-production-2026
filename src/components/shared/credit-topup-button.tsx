"use client"

import { Button } from "@/components/ui/button"
import { CreditCard } from "lucide-react"
import * as React from "react"

interface CreditTopUpButtonProps {
  packageId: string
  provider: "stripe" | "square"
  disabled?: boolean
}

export function CreditTopUpButton({ packageId, provider, disabled }: CreditTopUpButtonProps) {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleTopUp = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/checkout/credit-topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId, provider }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || "Checkout could not be started.")
        setLoading(false)
        return
      }

      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl)
      } else if (data.checkoutId) {
        setError("Checkout was created but no redirect URL was returned.")
        setLoading(false)
      }
    } catch {
      setError("Checkout could not be started. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="mt-3">
      <Button
        size="sm"
        className="w-full"
        onClick={handleTopUp}
        disabled={disabled || loading}
      >
        <CreditCard className="mr-2 h-4 w-4" />
        {loading ? "Opening..." : `Buy with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`}
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}
