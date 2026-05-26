"use client"

import * as React from "react"

type PopoverContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null)

function usePopover() {
  const context = React.useContext(PopoverContext)
  if (!context) {
    throw new Error("Popover components must be used within Popover")
  }
  return context
}

export function Popover({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)

  return (
    <PopoverContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-flex">{children}</div>
    </PopoverContext.Provider>
  )
}

export function PopoverTrigger({
  asChild,
  children,
}: {
  asChild?: boolean
  children: React.ReactElement<{ onClick?: React.MouseEventHandler }>
}) {
  const { open, setOpen } = usePopover()

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: (event: React.MouseEvent) => {
        children.props.onClick?.(event)
        setOpen(!open)
      },
    })
  }

  return (
    <button type="button" onClick={() => setOpen(!open)}>
      {children}
    </button>
  )
}

export function PopoverContent({
  align = "center",
  className,
  children,
}: {
  align?: "start" | "center" | "end"
  className?: string
  children: React.ReactNode
}) {
  const { open, setOpen } = usePopover()

  if (!open) return null

  const alignClass = {
    start: "left-0",
    center: "left-1/2 -translate-x-1/2",
    end: "right-0",
  }[align]

  return (
    <>
      <button
        type="button"
        aria-label="Close popover"
        className="fixed inset-0 z-40 cursor-default"
        onClick={() => setOpen(false)}
      />
      <div
        className={[
          "absolute top-full z-50 mt-2 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-lg",
          alignClass,
          className,
        ].filter(Boolean).join(" ")}
      >
        {children}
      </div>
    </>
  )
}
