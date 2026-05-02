import { ThemeToggle } from "@/components/theme-toggle"
import { auth } from "@/lib/auth"

export default async function Topbar() {
  const session = await auth()

  return (
    <div className="app-topbar">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-4 overflow-hidden">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
            <span className="text-[11px] font-semibold tracking-tight truncate max-w-[200px] uppercase">
              {session?.user?.name || "Guest Account"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* CSS-only Full-page Modal Trigger */}
          <label htmlFor="hybrid-modal-toggle" className="h-5 px-2 flex items-center text-[9px] uppercase font-bold tracking-tighter bg-gradient-primary text-white rounded cursor-pointer hover:opacity-90 transition-opacity">
            Hybrid AI
          </label>

          <input type="checkbox" id="hybrid-modal-toggle" className="hidden peer" />

          <div className="fixed inset-0 z-[200] hidden peer-checked:flex flex-col bg-background animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-page-title tracking-tighter">Hybrid AI Intelligence</h2>
              <label htmlFor="hybrid-modal-toggle" className="p-2 hover:bg-muted rounded-full cursor-pointer transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </label>
            </div>
            <div className="flex-1 p-8 overflow-y-auto">
              <div className="max-w-3xl mx-auto space-y-6">
                <p className="text-body-lg text-muted-foreground">Hybrid AI combines deterministic metrics with generative explanation layer.</p>
                {/* Content goes here */}
              </div>
            </div>
          </div>

          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
