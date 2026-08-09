import * as React from "react"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={[
          "flex h-12 w-full rounded-lg border border-input/80 bg-background/80 px-4 py-2 text-body text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-offset-background transition duration-200 file:border-0 file:bg-transparent file:text-body file:font-medium placeholder:text-muted-foreground/80 focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        ].join(" ")}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
