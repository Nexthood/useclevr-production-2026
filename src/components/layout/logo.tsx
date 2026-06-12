"use client"

import useclevrWordmarkDark from "@/assets/images/logos/useclevr-wordmark-dark.png"
import useclevrWordmarkLight from "@/assets/images/logos/useclevr-wordmark-light.png"

type Props = {
  className?: string
}

export function Logo({ className = "h-12 w-auto" }: Props) {
  return (
    <div className="flex items-center shrink-0">
      <img
        src={useclevrWordmarkDark.src}
        alt="UseClevr logo"
        className={["block dark:hidden select-none pointer-events-none align-middle", className].join(" ")}
        loading="eager"
        decoding="async"
      />

      <img
        src={useclevrWordmarkLight.src}
        alt="UseClevr logo"
        className={["hidden dark:block select-none pointer-events-none align-middle", className].join(" ")}
        loading="eager"
        decoding="async"
      />
    </div>
  )
}
