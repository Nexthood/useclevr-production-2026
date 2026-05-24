import * as React from "react";
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

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  React.useEffect(() => {
    if (open) {
      setVisible(true);
    } else if (visible) {
      const timeout = setTimeout(() => setVisible(false), 200);
      return () => clearTimeout(timeout);
    }
  }, [open, visible]);

  if (!mounted || !visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(2px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        className={[
          "relative w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg",
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
          className="absolute right-4 top-4 rounded-sm p-1 opacity-70 transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </div>
  );
};
DialogContent.displayName = "DialogContent";

type DialogHeaderProps = {
  children: React.ReactNode;
  className?: string;
};

const DialogHeader = ({ children, className }: DialogHeaderProps) => (
  <div className={["space-y-1.5", className].filter(Boolean).join(" ")}>{children}</div>
);
DialogHeader.displayName = "DialogHeader";

type DialogTitleProps = {
  children: React.ReactNode;
  className?: string;
};

const DialogTitle = ({ children, className }: DialogTitleProps) => (
  <h2 className={["text-lg font-semibold", className].filter(Boolean).join(" ")}>{children}</h2>
);
DialogTitle.displayName = "DialogTitle";

type DialogDescriptionProps = {
  children: React.ReactNode;
  className?: string;
};

const DialogDescription = ({ children, className }: DialogDescriptionProps) => (
  <p className={["text-sm text-muted-foreground", className].filter(Boolean).join(" ")}>
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
