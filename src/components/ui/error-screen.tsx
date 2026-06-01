"use client"

import { Button } from "@/components/ui/button"
import { debugError } from "@/lib/utils/debug"
import { useEffect } from "react"

interface ErrorScreenProps {
  error: Error & { digest?: string }
  reset: () => void
  icon: React.ComponentType<{ className?: string }>
  title: string
  message: string
}

export function ErrorScreen({ error, reset, icon: Icon, title, message }: ErrorScreenProps) {
  useEffect(() => {
    debugError(`${title}:`, error)
  }, [error, title])

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <Icon className="h-12 w-12 mx-auto text-destructive" />
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{message}</p>
        <div className="flex gap-4 justify-center">
          <Button onClick={() => reset()}>Try again</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>Refresh page</Button>
        </div>
      </div>
    </div>
  )
}
