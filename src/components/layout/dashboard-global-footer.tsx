import Link from "next/link"
import { FaApple, FaGooglePlay, FaLinkedin, FaXTwitter } from "react-icons/fa6"

export function DashboardGlobalFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-background px-4 py-2 text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <span>Copyright {year} UseClevr</span>
        <Link href="/terms" className="font-medium transition hover:text-foreground">
          Terms & Conditions
        </Link>
        <Link href="/privacy" className="font-medium transition hover:text-foreground">
          Privacy
        </Link>
        <a href="https://twitter.com/useclevr" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 transition hover:text-foreground">
          <FaXTwitter className="h-3.5 w-3.5" />
          X
        </a>
        <a href="https://linkedin.com/company/useclevr" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 transition hover:text-foreground">
          <FaLinkedin className="h-3.5 w-3.5" />
          LinkedIn
        </a>
        <span className="inline-flex items-center gap-2 font-medium text-foreground/80">
          <FaApple className="h-3.5 w-3.5" />
          App Store soon
        </span>
        <span className="inline-flex items-center gap-2 font-medium text-foreground/80">
          <FaGooglePlay className="h-3.5 w-3.5" />
          Google Play soon
        </span>
      </div>
    </footer>
  )
}
