"use client"

type Props = {
  // Optional extra classes; responsive height ensures readability
  className?: string
}

// Renders the UseClevr brand logo as an image asset, swapping automatically
// based on the active theme. Dark theme → white wordmark (/logos/publiclogosuseclevr-dark.png)
// Light theme → black wordmark (/logos/publiclogosuseclevr-light.png)
export function Logo({ className = "h-[120px] md:h-[155px] w-auto" }: Props) {
  return (
    <div className="flex items-center shrink-0">
      {/* Light mode: DARK/black wordmark */}
      <img
        src="/logos/publiclogosuseclevr-dark.png"
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
            console.warn(
              "Logo asset missing: /logos/publiclogosuseclevr-dark.png. Place it in /public/logos with transparent background (black wordmark for light mode)."
            )
          }
        }}
      />

      {/* Dark mode: LIGHT/white wordmark */}
      <img
        src="/logos/publiclogosuseclevr-light.png"
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
            console.warn(
              "Logo asset missing: /logos/publiclogosuseclevr-light.png. Place it in /public/logos with transparent background (white wordmark for dark mode)."
            )
          }
        }}
      />
    </div>
  )
}
