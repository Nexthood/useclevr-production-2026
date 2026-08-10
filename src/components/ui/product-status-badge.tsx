type ProductStatusBadgeProps = {
  status: "beta"
  className?: string
}

const productStatusLabels: Record<ProductStatusBadgeProps["status"], string> = {
  beta: "BETA",
}

export function ProductStatusBadge({ status, className }: ProductStatusBadgeProps) {
  const label = productStatusLabels[status]

  return (
    <span
      aria-label={`${label} product status`}
      className={[
        "inline-flex h-5 shrink-0 items-center rounded-md border border-fuchsia-300/35 bg-fuchsia-300/10 px-1.5 text-[10px] font-semibold leading-none text-fuchsia-700 shadow-[0_0_18px_rgba(217,70,239,0.08)] dark:border-fuchsia-200/25 dark:bg-fuchsia-200/10 dark:text-fuchsia-100",
        className || "",
      ].join(" ")}
    >
      {label}
    </span>
  )
}
