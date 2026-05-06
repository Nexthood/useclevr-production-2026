import { ThemeToggle } from "@/components/theme-toggle"
import { auth } from "@/lib/auth"
import { Brain } from "lucide-react"

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
          <label htmlFor="hybrid-modal-toggle" className="h-6 px-3 flex items-center text-[10px] uppercase font-bold tracking-tighter bg-gradient-primary text-white rounded-full cursor-pointer hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-purple-500/25 animate-pulse">
            <Brain className="h-3 w-3 mr-1" />
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

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">Cloud Mode</h3>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0"></div>
                        <div>
                          <p className="font-medium text-sm">Fast Processing</p>
                          <p className="text-xs text-muted-foreground">Leverage powerful cloud infrastructure for quick analysis</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0"></div>
                        <div>
                          <p className="font-medium text-sm">Always Available</p>
                          <p className="text-xs text-muted-foreground">24/7 access to AI capabilities</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0"></div>
                        <div>
                          <p className="font-medium text-sm">Advanced Features</p>
                          <p className="text-xs text-muted-foreground">Access to latest AI models and features</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">Local Mode</h3>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                        <div>
                          <p className="font-medium text-sm">Data Privacy</p>
                          <p className="text-xs text-muted-foreground">Your data never leaves your device</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                        <div>
                          <p className="font-medium text-sm">Offline Capable</p>
                          <p className="text-xs text-muted-foreground">Work without internet connection</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                        <div>
                          <p className="font-medium text-sm">Custom Models</p>
                          <p className="text-xs text-muted-foreground">Fine-tune AI for your specific needs</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-2">How It Works</h4>
                  <p className="text-sm text-muted-foreground">
                    UseClevr intelligently switches between cloud and local AI based on your data sensitivity,
                    connection status, and processing requirements. You get the best of both worlds -
                    powerful cloud processing when you need it, and complete data privacy when required.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
