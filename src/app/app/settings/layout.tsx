import type React from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { SettingsNav } from "./settings-nav"

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card h-16">
        <div className="flex h-16 items-center justify-between px-6 gap-4">
          <div className="flex items-center gap-4">
            <Link href="/app">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="px-5 py-5">
        <div className="flex w-full flex-col gap-5 md:flex-row">
          <SettingsNav />
          <section className="min-w-0 flex-1">{children}</section>
        </div>
      </main>
    </div>
  )
}
