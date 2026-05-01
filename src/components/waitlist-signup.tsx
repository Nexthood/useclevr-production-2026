"use client"

import * as React from "react"
import { joinWaitlist } from "@/app/actions/waitlist"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, CheckCircle2 } from "lucide-react"

interface WaitlistSignupProps {
  source?: string
}

export function WaitlistSignup({ source = "landing_page" }: WaitlistSignupProps) {
  const [email, setEmail] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [success, setSuccess] = React.useState(false)
  const [error, setError] = React.useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    const result = await joinWaitlist(email, source)

    if (result.success) {
      setSuccess(true)
    } else {
      setError(result.error || "Something went wrong. Please try again.")
    }

    setIsLoading(false)
  }

  if (success) {
    return (
      <div className="flex items-center gap-3 text-green-400 bg-green-500/10 px-4 py-3 rounded-xl">
        <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
        <span className="text-sm font-medium">You're on the list. We'll keep you updated.</span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
          className="bg-background/50 border-border/50 focus:border-brand-purple focus:ring-brand-purple"
        />
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-white hover:opacity-90 whitespace-nowrap"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Join waitlist"
          )}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-destructive mt-2">{error}</p>
      )}
    </form>
  )
}