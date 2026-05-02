"use client"

import { debugError } from "@/lib/debug"



import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useNotice } from "@/components/ui/notice-bar"

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { showNotice } = useNotice()

  useEffect(() => {
    debugError("App error:", error)
    showNotice({
      type: "error",
      title: "Dashboard could not load.",
      message: "Try again, or refresh the page if the problem continues.",
    })
  }, [error, showNotice])

  return (
    <div className="min-h-screen flex items-center justify-center p-4 ml-64">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Something went wrong</h1>
          <p className="text-muted-foreground">
            We encountered an error while loading the dashboard. This might be due to a database connection issue.
          </p>
        </div>

        {error.message && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
            <p className="font-medium">Error details:</p>
            <p className="mt-1">{error.message}</p>
          </div>
        )}

        <div className="flex gap-4 justify-center">
          <Button onClick={() => reset()}>
            Try again
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Refresh page
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          If the problem persists, please check your database connection.
        </p>
      </div>
    </div>
  )
}
