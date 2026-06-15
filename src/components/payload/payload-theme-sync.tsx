"use client"

import { useEffect } from "react"

export function TailwindThemeSync() {
  useEffect(() => {
    const html = document.documentElement

    function sync() {
      const theme = html.getAttribute("data-theme")
      if (theme === "dark") {
        html.classList.add("dark")
      } else {
        html.classList.remove("dark")
      }
    }

    sync()

    const observer = new MutationObserver(() => sync())
    observer.observe(html, { attributes: true, attributeFilter: ["data-theme"] })
    return () => observer.disconnect()
  }, [])

  return null
}
