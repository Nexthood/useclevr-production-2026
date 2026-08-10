import { Info } from "lucide-react"

export const AI_ACCURACY_DISCLAIMER_TEXT =
  "UseClevr AI can make mistakes. Verify important business and financial information."

const AI_ACCURACY_TOOLTIP =
  "AI-generated insights may contain errors. Review supporting evidence and verify important decisions."

type AiAccuracyDisclaimerProps = {
  className?: string
  iconClassName?: string
  textClassName?: string
}

export function AiAccuracyDisclaimer({
  className,
  iconClassName,
  textClassName,
}: AiAccuracyDisclaimerProps) {
  return (
    <p
      className={[
        "mt-2 flex items-start gap-1.5 text-xs leading-5 text-muted-foreground",
        className || "",
      ].join(" ")}
      title={AI_ACCURACY_TOOLTIP}
    >
      <Info
        className={[
          "mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-500/80 dark:text-cyan-300/80",
          iconClassName || "",
        ].join(" ")}
        aria-hidden="true"
      />
      <span className={textClassName}>{AI_ACCURACY_DISCLAIMER_TEXT}</span>
    </p>
  )
}
