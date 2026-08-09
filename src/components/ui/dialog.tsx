import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type DialogContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialog() {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error("Dialog components must be used within a Dialog");
  return ctx;
}

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

const Dialog = ({ open, onOpenChange, children }: DialogProps) => (
  <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>
);
Dialog.displayName = "Dialog";

type DialogTriggerProps = {
  asChild?: boolean;
  children: React.ReactNode;
};

const DialogTrigger = ({ children }: DialogTriggerProps) => {
  const { onOpenChange } = useDialog();
  const child = React.Children.only(children) as React.ReactElement<
    React.HTMLAttributes<HTMLElement>
  >;
  return React.cloneElement(child, {
    onClick: () => onOpenChange(true),
  });
};
DialogTrigger.displayName = "DialogTrigger";

type DialogContentProps = {
  children: React.ReactNode;
  className?: string;
};

const DialogContent = ({ children, className }: DialogContentProps) => {
  const { open, onOpenChange } = useDialog();
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  React.useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setVisible(true);
    } else if (visible) {
      const timeout = setTimeout(() => setVisible(false), 200);
      return () => clearTimeout(timeout);
    }
  }, [open, visible]);

  React.useEffect(() => {
    if (!open || !visible) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusable = getFocusableElements(panelRef.current);
    const firstTarget = focusable[0] || panelRef.current;
    firstTarget?.focus();

    return () => {
      document.body.style.overflow = originalOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, [open, visible]);

  React.useEffect(() => {
    if (!open || !visible) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = getFocusableElements(panelRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, visible, onOpenChange]);

  if (!mounted || !visible) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center overflow-y-auto p-4 sm:p-6"
      style={{
        background: "rgba(8, 13, 30, 0.64)",
        backdropFilter: "blur(8px)",
        isolation: "isolate",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={[
          "relative my-auto max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/[0.08] bg-card/95 p-6 shadow-[0_34px_100px_rgba(8,13,30,0.34),inset_0_1px_0_rgba(255,255,255,0.08)] outline-none backdrop-blur-xl",
          open ? "animate-in fade-in-0 zoom-in-95" : "animate-out fade-out-0 zoom-out-95",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-md p-1.5 opacity-70 transition hover:bg-muted/70 hover:opacity-100"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </div>,
    document.body,
  );
};
DialogContent.displayName = "DialogContent";

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true");
}

type DialogHeaderProps = {
  children: React.ReactNode;
  className?: string;
};

const DialogHeader = ({ children, className }: DialogHeaderProps) => (
  <div className={["space-y-2", className].filter(Boolean).join(" ")}>{children}</div>
);
DialogHeader.displayName = "DialogHeader";

type DialogTitleProps = {
  children: React.ReactNode;
  className?: string;
};

const DialogTitle = ({ children, className }: DialogTitleProps) => (
  <h2 className={["text-lg font-semibold leading-tight", className].filter(Boolean).join(" ")}>{children}</h2>
);
DialogTitle.displayName = "DialogTitle";

type DialogDescriptionProps = {
  children: React.ReactNode;
  className?: string;
};

const DialogDescription = ({ children, className }: DialogDescriptionProps) => (
  <p className={["text-sm leading-relaxed text-muted-foreground", className].filter(Boolean).join(" ")}>
    {children}
  </p>
);
DialogDescription.displayName = "DialogDescription";

type DialogFooterProps = {
  children: React.ReactNode;
  className?: string;
};

const DialogFooter = ({ children, className }: DialogFooterProps) => (
  <div className={["flex justify-end gap-2 pt-4", className].filter(Boolean).join(" ")}>
    {children}
  </div>
);
DialogFooter.displayName = "DialogFooter";

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
};
