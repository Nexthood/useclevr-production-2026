"use client"

import * as React from "react"
import { X, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CREDIT_PACKAGES } from "@/lib/credits-context"

interface UpgradeModalProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title?: string
  message?: string
}

export function UpgradeModal({ open: externalOpen, onOpenChange: externalOnOpenChange, title, message }: UpgradeModalProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  
  const isControlled = externalOpen !== undefined
  const isOpen = isControlled ? externalOpen : internalOpen
  
  const setOpen = (open: boolean) => {
    if (isControlled) {
      externalOnOpenChange?.(open)
    } else {
      setInternalOpen(open)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <Card className="w-full max-w-md p-6 relative z-10">
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="text-xl font-bold mb-2">{title || "No credits remaining"}</h2>
        <p className="text-muted-foreground mb-6">
          {message || "To generate additional reports, please purchase more credits."}
        </p>
        
        {/* Credit Packages */}
        <div className="space-y-3 mb-6">
          {CREDIT_PACKAGES.map((pkg) => (
            <button
              key={pkg.id}
              className="w-full flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary hover:bg-accent/5 transition-all"
              onClick={() => {
                // Handle purchase - for now just close modal
                setOpen(false)
              }}
            >
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <div className="font-medium">{pkg.name}</div>
                  <div className="text-sm text-muted-foreground">{pkg.credits} credits</div>
                </div>
              </div>
              <div className="font-bold text-lg">€{pkg.price}</div>
            </button>
          ))}
        </div>
        
        <Button className="w-full" onClick={() => setOpen(false)}>
          Buy Credits
        </Button>
      </Card>
    </div>
  )
}
