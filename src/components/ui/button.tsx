import * as React from "react"

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
    size?: "default" | "sm" | "lg" | "icon"
  }
>(({ className, variant = "default", size = "default", ...props }, ref) => {
  const variants = {
    default: "border border-primary/30 bg-gradient-to-b from-primary/95 to-primary/80 text-primary-foreground shadow-[0_10px_30px_hsl(var(--primary)/0.18),inset_0_1px_0_rgba(255,255,255,0.24)] hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-[0_14px_38px_hsl(var(--primary)/0.24),inset_0_1px_0_rgba(255,255,255,0.3)]",
    destructive: "border border-destructive/30 bg-gradient-to-b from-destructive to-destructive/85 text-destructive-foreground shadow-[0_10px_28px_hsl(var(--destructive)/0.16)] hover:-translate-y-0.5 hover:bg-destructive/90",
    outline: "border border-primary/25 bg-background/70 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm hover:-translate-y-0.5 hover:border-primary/45 hover:bg-primary/10 hover:text-foreground hover:shadow-[0_10px_28px_hsl(var(--primary)/0.10)]",
    secondary: "border border-secondary/25 bg-gradient-to-b from-secondary/20 to-secondary/10 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] hover:-translate-y-0.5 hover:border-secondary/40 hover:bg-secondary/20",
    ghost: "text-foreground/80 hover:-translate-y-0.5 hover:bg-muted/70 hover:text-foreground",
    link: "text-primary underline-offset-4 hover:underline",
  }

  const sizes = {
    default: "h-11 px-6 py-2 text-body",
    sm: "h-9 rounded-md px-4 text-body",
    lg: "h-12 rounded-lg px-8 text-body-lg",
    icon: "h-10 w-10",
  }

  return (
    <button
      className={[
        "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      ].join(" ")}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button }
