"use client"

import { Button } from "@/components/ui/button"
import { Cookie } from "lucide-react"
import * as React from "react"

export function CookieBar() {
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const consent = localStorage.getItem("cookie-consent")
    if (!consent) {
      setVisible(true)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem("cookie-consent", "accepted")
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur px-4 py-3">
      <div className="flex max-w-6xl mx-auto items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Cookie className="h-4 w-4 text-primary" />
          <span>We use essential cookies for authentication and preferences. By using this site, you accept these necessary cookies.</span>
        </div>
        <Button size="sm" onClick={handleAccept}>
          Accept
        </Button>
      </div>
    </div>
  )
}