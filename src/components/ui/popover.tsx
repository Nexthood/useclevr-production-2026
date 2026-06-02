"use client";

import * as React from "react";

type PopoverContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  contentId: string;
};

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

function usePopover() {
  const context = React.useContext(PopoverContext);
  if (!context) {
    throw new Error("Popover components must be used within Popover");
  }
  return context;
}

export function Popover({
  children,
  className,
  open: controlledOpen,
  onOpenChange,
}: {
  children: React.ReactNode;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const contentId = React.useId();
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      onOpenChange?.(nextOpen);
      if (controlledOpen === undefined) {
        setUncontrolledOpen(nextOpen);
      }
    },
    [controlledOpen, onOpenChange],
  );

  return (
    <PopoverContext.Provider value={{ open, setOpen, contentId }}>
      <div className={["relative inline-flex", className].filter(Boolean).join(" ")}>
        {children}
      </div>
    </PopoverContext.Provider>
  );
}

export function PopoverTrigger({
  asChild,
  children,
}: {
  asChild?: boolean;
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
}) {
  const { open, setOpen, contentId } = usePopover();

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement<React.HTMLAttributes<HTMLElement>>(children, {
      "aria-expanded": open,
      "aria-haspopup": "dialog" as const,
      "aria-controls": contentId,
      onClick: (event) => {
        children.props.onClick?.(event as React.MouseEvent<HTMLElement>);
        setOpen(!open);
      },
    });
  }

  return (
    <button
      type="button"
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-controls={contentId}
      onClick={() => setOpen(!open)}
    >
      {children}
    </button>
  );
}

export function PopoverContent({
  align = "center",
  className,
  children,
}: {
  align?: "start" | "center" | "end";
  className?: string;
  children: React.ReactNode;
}) {
  const { open, setOpen, contentId } = usePopover();

  React.useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  if (!open) return null;

  const alignClass = {
    start: "left-0",
    center: "left-1/2 -translate-x-1/2",
    end: "right-0",
  }[align];

  return (
    <>
      <button
        type="button"
        aria-label="Close popover"
        className="fixed inset-0 z-[1000] cursor-default"
        onClick={() => setOpen(false)}
      />
      <div
        id={contentId}
        role="dialog"
        className={[
          "absolute top-full z-[1010] mt-2 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-2xl",
          alignClass,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </div>
    </>
  );
}
