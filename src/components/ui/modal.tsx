import { X } from "lucide-react"
import * as React from "react"
import { createPortal } from "react-dom"

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
  /** Shared modal layout. */
  variant?: "dialog" | "fullscreen" | "sidebar"
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
  variant = "dialog",
  children,
}: ModalProps) {
  // Shared ref — stable across renders
  const overlayRef = React.useRef<HTMLDivElement | null>(null)
  const [mounted, setMounted] = React.useState(false)

  // Mount / unmount the portal root once
  React.useEffect(() => {
    const root = document.createElement("div")
    root.id = "modal-portal-root"
    root.style.cssText = "position:fixed;inset:0;z-index:1000;pointer-events:none"
    document.body.appendChild(root)
    overlayRef.current = root
    setMounted(true)

    return () => {
      root.remove()
      overlayRef.current = null
      setMounted(false)
    }
  }, [])

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
  const shellClassName = {
    dialog:
      "relative max-h-[calc(100vh-4rem)] w-full max-w-2xl overflow-auto rounded-xl border border-border bg-card shadow-2xl animate-in fade-in duration-200 sm:max-w-4xl",
    fullscreen:
      "relative flex h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-in fade-in duration-200",
    sidebar:
      "relative ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-border bg-card shadow-2xl animate-in slide-in-from-right duration-200",
  }[variant]
  const bodyClassName = variant === "dialog" ? "p-5" : "flex-1 overflow-auto p-5"
  const overlayClassName =
    variant === "sidebar"
      ? "fixed inset-0 z-[1000] flex justify-end"
      : "fixed inset-0 z-[1000] flex items-center justify-center p-4"

  return createPortal(
    <div
      className={[overlayClassName, className]
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
        className={shellClassName}
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
        <div className={bodyClassName}>{children}</div>
      </div>
    </div>,
    containerEl
  )
}
