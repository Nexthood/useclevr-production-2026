"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

import { Card } from "@/components/ui/card"

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  showCloseButton?: boolean
  variant?: "default" | "fullscreen"
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  showCloseButton = true,
  variant = "default",
}: ModalProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false)
      }
    }

    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [open, onOpenChange])

  if (!mounted || !open) return null

  if (variant === "fullscreen") {
    return createPortal(
      <div
        className="fixed inset-0 z-[1000] bg-background text-foreground"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div
          className="absolute inset-0 bg-black/55"
          onClick={() => onOpenChange(false)}
        />
        <div className={`relative z-10 h-full w-full ${className}`}>
          {children}
        </div>
      </div>,
      document.body,
    )
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/55 p-0 text-foreground backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="absolute inset-0"
        onClick={() => onOpenChange(false)}
      />
      <Card className={`relative z-10 h-full w-full max-w-full overflow-y-auto border-border bg-background p-0 shadow-2xl ${className}`}>
        <div className="flex items-center justify-between border-b px-6 py-4 sm:px-8">
          <div>
            <h2 id="modal-title" className="text-xl font-semibold tracking-tight">
              {title}
            </h2>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">
                {description}
              </p>
            )}
          </div>
          {showCloseButton && (
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full p-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="h-full overflow-y-auto p-6 sm:p-8">
          {children}
        </div>
      </Card>
    </div>,
    document.body,
  )
}
