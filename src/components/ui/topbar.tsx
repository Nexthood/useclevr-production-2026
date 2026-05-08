import { ThemeToggle } from "@/components/theme-toggle"
import HybridAiButton from "@/components/ui/hybrid-ai-button"

export default async function Topbar() {
  return (
    <div className="app-topbar">
      <div className="flex w-full items-center justify-end">
        <div className="flex items-center gap-2">
          <HybridAiButton />
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
