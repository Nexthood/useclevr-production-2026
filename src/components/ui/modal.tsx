import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

type ModalProps = {
  /** Controlled open / closed */
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Accessible label exposed via `aria-labelledby` */
  title: string
  /** Secondary descriptive text */
  description?: string
  /** Portal target element — must be mounted before open=true. Defaults to `document.body`. */
  container?: Element | null
  /** Portal class name for the backdrop element — always rendered at body level. */
  className?: string
  /** When `false` the close button in the header is hidden (default: `true`). */
  showCloseButton?: boolean
  children: React.ReactNode
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  container,
  className,
  showCloseButton = true,
  children,
}: ModalProps) {
  // Shared ref — stable across renders
  const overlayRef = React.useRef<HTMLDivElement | null>(null)
  const [mounted, setMounted] = React.useState(false)

  // Mount / unmount the portal root once
  React.useEffect(() => {
    if (!mounted) {
      const root = document.createElement("div")
      root.id = "modal-portal-root"
      root.style.cssText = "position:fixed;inset:0;z-index:1000;pointer-events:none"
      document.body.appendChild(root)
      overlayRef.current = root
      setMounted(true)
      return () => {
        root.remove()
        overlayRef.current = null
      }
    }
  }, [mounted])

  // Lock / unlock body scroll
  React.useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  // Escape key to close
  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, onOpenChange])

  if (!mounted || !open || !overlayRef.current) return null

  const containerEl = container ?? document.body

  return createPortal(
    <div
      className={["fixed inset-0 z-[1000] flex items-center justify-center", className]
        .filter(Boolean)
        .join(" ")}
      style={{
        pointerEvents: "auto",
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(2px)",
        isolation: "isolate", // ← new stacking context — safe against z-index siblings
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false)
      }}
    >
      <div
        className="relative max-h-[calc(100vh-4rem)] w-full max-w-2xl overflow-auto rounded-xl border border-border bg-card shadow-2xl animate-in fade-in duration-200 sm:max-w-4xl"
        style={{ pointerEvents: "auto" }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-5 py-4">
          <div>
            <h2 id="modal-title" className="text-lg font-semibold">
              {title}
            </h2>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {showCloseButton && (
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full p-2 transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    containerEl
  )
}
