"use client"

import { debugWarn } from "@/lib/debug"

type Props = {
  // Optional extra classes; responsive height ensures readability
  className?: string
}

// Renders the UseClevr brand logo as an image asset, swapping automatically
// based on the active theme.
export function Logo({ className = "h-12 w-auto" }: Props) {
  return (
    <div className="flex items-center shrink-0">
      {/* Light mode: DARK/black wordmark */}
      <img
        src="/assets/images/logos/publiclogosuseclevr-dark.png"
        alt="UseClevr logo"
        className={[
          // Ensure sharp, clean rendering and preserve aspect ratio
          "block dark:hidden select-none pointer-events-none align-middle",
          className,
        ].join(" ")}
        loading="eager"
        decoding="async"
        onError={() => {
          // Helps diagnose missing asset issues without altering UX
          if (typeof window !== "undefined") {
            debugWarn(
              "Logo asset missing: /assets/images/logos/publiclogosuseclevr-dark.png. Place it in assets/images/logos with transparent background (black wordmark for light mode)."
            )
          }
        }}
      />

      {/* Dark mode: LIGHT/white wordmark */}
      <img
        src="/assets/images/logos/publiclogosuseclevr-light.png"
        alt="UseClevr logo"
        className={[
          // Swap in dark mode without layout shift; same sizing classes
          "hidden dark:block select-none pointer-events-none align-middle",
          className,
        ].join(" ")}
        loading="eager"
        decoding="async"
        onError={() => {
          if (typeof window !== "undefined") {
            debugWarn(
              "Logo asset missing: /assets/images/logos/publiclogosuseclevr-light.png. Place it in assets/images/logos with transparent background (white wordmark for dark mode)."
            )
          }
        }}
      />
    </div>
  )
}
