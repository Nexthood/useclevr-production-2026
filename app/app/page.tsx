import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, Database, Sparkles, ArrowRight, FileSpreadsheet, TrendingUp, Zap, Brain } from "lucide-react"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"
import { MegaButton } from "@/components/mega-button"

async function getUserStats() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return null
    }
    
    const userDatasets = await db.query.datasets.findMany({
      where: eq(datasets.userId, session.user.id),
      columns: {
        rowCount: true,
      },
    })

    const datasetCount = userDatasets.length
    const totalRows = userDatasets.reduce((sum, ds) => sum + (ds.rowCount || 0), 0)

    return {
      datasetCount,
      totalRows,
    }
  } catch (error) {
    console.error("[DASHBOARD] Database error:", error)
    return null
  }
}

export default async function AppDashboard() {
  const session = await auth()
  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "User"

  const stats = await getUserStats()
  const isDatabaseAvailable = stats !== null
  const displayStats = stats || { datasetCount: 0, totalRows: 0 }

  const statsCards = [
    { label: "Total Datasets", value: displayStats.datasetCount.toString(), hint: displayStats.datasetCount === 0 ? "Upload a dataset to begin" : "", icon: Database, color: "text-purple-400" },
    { label: "Total Rows", value: displayStats.totalRows.toLocaleString(), hint: displayStats.totalRows === 0 ? "No data yet" : "", icon: FileSpreadsheet, color: "text-cyan-400" },
    { label: "AI Queries", value: "0", hint: "Insights will appear after analysis", icon: Sparkles, color: "text-purple-400" },
    { label: "Insights Found", value: "0", hint: "Insights will appear after analysis", icon: TrendingUp, color: "text-green-400" },
  ]

  const quickActions = [
    {
      title: "Browse Datasets",
      description: "View and manage your uploaded datasets.",
      icon: Database,
      href: "/app/datasets",
      gradient: "from-cyan-500 to-blue-500",
    },
    {
      title: "AI Analyst",
      description: "Ask questions and explore your data with AI.",
      icon: Sparkles,
      href: "/app/assistant",
      gradient: "from-purple-500 to-pink-500",
    },
  ]

  return (
    <div className="min-h-screen bg-background pl-10">
      {/* Header */}
      <header className="border-b border-border bg-card h-16">
        <div className="flex h-16 items-center justify-between px-8">
          <div className="pl-2">
            <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Welcome back, {userName}</p>
          </div>
          <div className="flex items-center gap-3">
            <MegaButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="max-w-6xl mx-auto space-y-8 pt-6">
          {!isDatabaseAvailable && (
            <Card className="p-3 bg-amber-500/10 border-amber-500/20">
              <p className="text-sm text-amber-400">
                Connection issue detected. Some features may be temporarily unavailable.
              </p>
            </Card>
          )}

          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-4">
            {statsCards.map((stat, index) => (
              <Card key={index} className="p-4 bg-card border-border">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold text-foreground truncate">{stat.value}</p>
                    {stat.hint && <p className="text-xs text-muted-foreground/70 truncate">{stat.hint}</p>}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-4">
            {quickActions.map((action, index) => (
              <Card key={index} className="p-4 hover:border-primary/30 transition-all duration-300 group bg-card border-border">
                <div className="flex items-start justify-between mb-3">
                  <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${action.gradient} flex items-center justify-center`}>
                    <action.icon className="h-5 w-5 text-white" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">{action.title}</h3>
                <p className="text-muted-foreground text-sm mb-3">
                  {action.description}
                </p>
                <Link href={action.href}>
                  <Button variant="outline" className="w-full text-sm border-border text-foreground hover:bg-muted">
                    {action.title === "Upload Dataset" ? "Upload now" : "View all"}
                  </Button>
                </Link>
              </Card>
            ))}
          </div>

          {/* Empty State - Main Upload CTA */}
          {displayStats.datasetCount === 0 ? (
            <Card className="p-6 bg-card border-border">
              <div className="flex items-center gap-5">
                <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center flex-shrink-0">
                  <Database className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-foreground mb-0.5">Upload your first dataset</h3>
                  <p className="text-muted-foreground text-sm">
                    Get instant insights from CSV files in seconds.
                  </p>
                </div>
                <Link href="/app/upload">
                  <Button className="bg-gradient-primary hover:opacity-90 flex-shrink-0">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload CSV
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <Card className="p-4 bg-card border-border">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Your Data</h3>
                <Link href="/app/datasets">
                  <Button variant="outline" size="sm" className="border-border text-foreground hover:bg-muted">
                    <Database className="mr-2 h-4 w-4" />
                    View all datasets
                  </Button>
                </Link>
              </div>
            </Card>
          )}

          {/* Features hint */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-card border border-border">
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <Zap className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <h4 className="font-medium text-foreground text-sm">Instant Analysis</h4>
                <p className="text-xs text-muted-foreground">Get insights in under 60 seconds</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-card border border-border">
              <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-4 w-4 text-cyan-400" />
              </div>
              <div>
                <h4 className="font-medium text-foreground text-sm">Natural Language</h4>
                <p className="text-xs text-muted-foreground">Ask questions in plain English</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-card border border-border">
              <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <Database className="h-4 w-4 text-green-400" />
              </div>
              <div>
                <h4 className="font-medium text-foreground text-sm">Private & Secure</h4>
                <p className="text-xs text-muted-foreground">Your data stays yours</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
