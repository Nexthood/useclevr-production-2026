"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { updateProfile } from "@/app/actions/settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useNotice } from "@/components/ui/notice-bar"

type ProfileFormProps = {
  fullName: string
  email: string
  isDemo: boolean
  loadError?: string | null
}

export function ProfileForm({ fullName, email, isDemo, loadError }: ProfileFormProps) {
  const router = useRouter()
  const { showNotice } = useNotice()
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    if (!loadError) {
      return
    }

    showNotice({
      type: "error",
      title: "Profile loaded partially.",
      message: loadError,
    })
  }, [loadError, showNotice])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)

    const result = await updateProfile(new FormData(event.currentTarget))

    if (result.error) {
      showNotice({
        type: "error",
        title: "Profile was not saved.",
        message: result.error,
      })
    } else {
      showNotice({
        type: isDemo ? "info" : "success",
        title: result.message || "Profile saved.",
      })
      router.refresh()
    }

    setIsSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {loadError && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
          {loadError}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="fullName" className="text-foreground">Name</Label>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={fullName}
          className="bg-muted border-input"
          autoComplete="name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" className="text-foreground">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={email}
          className="bg-muted border-input"
          autoComplete="email"
          required
        />
      </div>

      <Button type="submit" disabled={isSaving} className="bg-gradient-primary hover:opacity-90">
        {isSaving ? "Saving..." : "Save profile"}
      </Button>
    </form>
  )
}
