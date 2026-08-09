import * as React from "react";
import { ChevronDown } from "lucide-react";

type SelectContextValue = {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
};

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelect() {
  const ctx = React.useContext(SelectContext);
  if (!ctx) throw new Error("Select components must be used within a Select");
  return ctx;
}

type SelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
};

const Select = ({ value, onValueChange, children, disabled: _disabled }: SelectProps) => {
  const [open, setOpen] = React.useState(false);

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
};
Select.displayName = "Select";

type SelectTriggerProps = {
  children: React.ReactNode;
  className?: string;
};

const SelectTrigger = ({ children, className }: SelectTriggerProps) => {
  const { open, setOpen } = useSelect();

  return (
    <button
      type="button"
      className={[
        "flex h-10 w-full items-center justify-between rounded-lg border border-input/80 bg-background/80 px-3 py-2 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition duration-200",
        "hover:border-primary/35 focus:outline-none focus:ring-2 focus:ring-ring/35 focus:ring-offset-0",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => setOpen(!open)}
    >
      <span className="truncate">{children}</span>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  );
};
SelectTrigger.displayName = "SelectTrigger";

const SelectValue = ({ placeholder }: { placeholder?: string }) => {
  const { value } = useSelect();
  return <>{value || placeholder}</>;
};
SelectValue.displayName = "SelectValue";

type SelectContentProps = {
  children: React.ReactNode;
  className?: string;
};

const SelectContent = ({ children, className }: SelectContentProps) => {
  const { open } = useSelect();

  if (!open) return null;

  return (
    <div
      className={[
        "absolute top-full z-50 mt-1 w-full overflow-hidden rounded-lg border border-border/70 bg-popover/95 text-popover-foreground shadow-[0_18px_48px_rgba(8,13,30,0.18),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="max-h-60 overflow-auto py-1">{children}</div>
    </div>
  );
};
SelectContent.displayName = "SelectContent";

type SelectItemProps = {
  value: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
};

const SelectItem = ({ value: itemValue, children, className, disabled }: SelectItemProps) => {
  const { value, onValueChange, setOpen } = useSelect();

  return (
    <div
      className={[
        "relative flex cursor-default select-none items-center rounded-md px-2.5 py-2 text-sm transition-colors",
        "focus:bg-accent/10 focus:text-foreground",
        value === itemValue && "bg-accent/15 text-foreground",
        disabled && "pointer-events-none opacity-50",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onMouseDown={() => {
        if (disabled) return;
        onValueChange(itemValue);
        setOpen(false);
      }}
    >
      {children}
    </div>
  );
};
SelectItem.displayName = "SelectItem";

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
