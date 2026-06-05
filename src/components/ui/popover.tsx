"use client";

import * as React from "react";
import { createPortal } from "react-dom";

type PopoverContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  contentId: string;
  triggerRef: React.RefObject<HTMLElement | null>;
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
  const triggerRef = React.useRef<HTMLElement | null>(null);
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
    <PopoverContext.Provider value={{ open, setOpen, contentId, triggerRef }}>
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
  const { open, setOpen, contentId, triggerRef } = usePopover();

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement<React.HTMLAttributes<HTMLElement>>(children, {
      ref: (node: HTMLElement | null) => {
        triggerRef.current = node;
        const childRef = (children as React.ReactElement & { ref?: React.Ref<HTMLElement> }).ref;
        if (typeof childRef === "function") childRef(node);
        else if (childRef && typeof childRef === "object") {
          (childRef as React.MutableRefObject<HTMLElement | null>).current = node;
        }
      },
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
  const { open, setOpen, contentId, triggerRef } = usePopover();
  const [mounted, setMounted] = React.useState(false);
  const [position, setPosition] = React.useState<React.CSSProperties>({});

  const updatePosition = React.useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const top = rect.bottom + 8;

    setPosition(
      align === "start"
        ? { top, left: rect.left }
        : align === "end"
          ? { top, right: Math.max(8, window.innerWidth - rect.right) }
          : { top, left: rect.left + rect.width / 2, transform: "translateX(-50%)" },
    );
  }, [align, triggerRef]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  React.useEffect(() => {
    if (!open) return;
    updatePosition();

    const handleLayout = () => updatePosition();
    window.addEventListener("resize", handleLayout);
    window.addEventListener("scroll", handleLayout, true);
    return () => {
      window.removeEventListener("resize", handleLayout);
      window.removeEventListener("scroll", handleLayout, true);
    };
  }, [open, updatePosition]);

  if (!open || !mounted) return null;

  return createPortal(
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
          "fixed z-[1200] max-w-[calc(100vw-1rem)] rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-2xl",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={position}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
