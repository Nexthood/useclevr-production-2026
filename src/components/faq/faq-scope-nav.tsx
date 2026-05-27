import Link from "next/link"

type FaqScopeNavProps = {
  activeScope: "user" | "operator"
  showOperator: boolean
}

export function FaqScopeNav({ activeScope, showOperator }: FaqScopeNavProps) {
  const items = [
    { label: "User FAQ", href: "/app/faq", scope: "user" as const },
    ...(showOperator ? [{ label: "Operator FAQ", href: "/app/faq?scope=operator", scope: "operator" as const }] : []),
  ]

  return (
    <nav className="border-b border-border bg-background px-5" aria-label="FAQ sections">
      <div className="mx-auto flex max-w-4xl gap-2 overflow-x-auto py-2">
        {items.map((item) => {
          const active = item.scope === activeScope

          return (
            <Link
              key={item.scope}
              href={item.href}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
