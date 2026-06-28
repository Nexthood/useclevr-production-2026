import type React from "react"

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-background pt-[var(--app-topbar-offset,40px)]">
      <main className="px-5 py-5">
        <div className="max-w-4xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}