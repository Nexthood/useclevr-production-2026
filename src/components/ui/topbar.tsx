import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import Link from "next/link"

export default async function Topbar() {
  const session = await auth()

  const profile = session?.user?.id
    ? await db.query.profiles.findFirst({ where: eq(profiles.userId, session.user.id) })
    : null

  const hasCredits = profile ? (profile.subscriptionTier !== 'free' || profile.freeUploadsUsed < 2) : false

  return (
    <div className="app-topbar">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-semibold tracking-tight">
              {session?.user?.name || "Guest Account"}
            </span>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              href={hasCredits ? "/app/upload" : "#"}
              className={`h-7 px-3 flex items-center text-[10px] uppercase font-bold tracking-widest rounded-md transition-colors border ${
                hasCredits
                ? "border-primary/50 bg-primary/5 text-primary hover:bg-primary/20"
                : "border-muted text-muted-foreground cursor-not-allowed opacity-50"
              }`}
            >
              {hasCredits ? "↑ Upload" : "Limit Reached"}
            </Link>
            <Link
              href="/app/datasets"
              className="h-7 px-3 flex items-center text-[10px] uppercase font-bold tracking-widest rounded-md border border-border hover:bg-muted/20 transition-colors"
            >
              Datasets
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button className="h-7 px-3 text-[10px] uppercase font-bold tracking-widest border border-primary/30 rounded-md hover:bg-primary/10 transition-colors">
            Hybrid AI
          </button>
          <div className="h-7 w-7 rounded-md border border-border flex items-center justify-center bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
             <span className="text-xs">🌓</span>
          </div>
        </div>
      </div>
    </div>
  )
}
