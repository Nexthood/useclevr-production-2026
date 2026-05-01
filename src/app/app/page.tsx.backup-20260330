"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, Database, Sparkles } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"

export default function AppDashboard() {
  const { user } = useAuth()

  return (
    <div className="flex flex-col">
      <header className="border-b border-border/40 bg-background">
        <div className="flex h-16 items-center px-6">
          <h1 className="text-2xl font-bold">Dashboard</h1>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Welcome Section */}
          <div className="space-y-2">
            <h2 className="text-3xl font-bold">Welcome back{user?.name ? `, ${user.name}` : ""}!</h2>
            <p className="text-muted-foreground">
              Get started by uploading your first dataset or exploring your existing data.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6 space-y-4 hover:border-primary/50 transition-colors">
              <div className="h-12 w-12 rounded-lg bg-[#7C3AED]/10 flex items-center justify-center">
                <Upload className="h-6 w-6 text-[#7C3AED]" />
              </div>
              <h3 className="text-xl font-semibold">Upload Dataset</h3>
              <p className="text-muted-foreground text-sm">
                Import CSV, Excel, or JSON files to start analyzing your data.
              </p>
              <Link href="/app/upload">
                <Button className="w-full">Upload now</Button>
              </Link>
            </Card>

            <Card className="p-6 space-y-4 hover:border-primary/50 transition-colors">
              <div className="h-12 w-12 rounded-lg bg-[#06B6D4]/10 flex items-center justify-center">
                <Database className="h-6 w-6 text-[#06B6D4]" />
              </div>
              <h3 className="text-xl font-semibold">View Datasets</h3>
              <p className="text-muted-foreground text-sm">
                Browse and manage all your uploaded datasets in one place.
              </p>
              <Link href="/app/datasets">
                <Button variant="outline" className="w-full bg-transparent">
                  View datasets
                </Button>
              </Link>
            </Card>

            <Card className="p-6 space-y-4 hover:border-primary/50 transition-colors">
              <div className="h-12 w-12 rounded-lg bg-[#7C3AED]/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-[#7C3AED]" />
              </div>
              <h3 className="text-xl font-semibold">AI Assistant</h3>
              <p className="text-muted-foreground text-sm">Ask questions about your data in natural language.</p>
              <Link href="/app/assistant">
                <Button variant="outline" className="w-full bg-transparent">
                  Open assistant
                </Button>
              </Link>
            </Card>
          </div>

          {/* Stats (demo) */}
          <div className="grid md:grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Total Datasets</p>
              <p className="text-2xl font-bold">0</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Total Rows</p>
              <p className="text-2xl font-bold">0</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">AI Queries</p>
              <p className="text-2xl font-bold">0</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Reports Generated</p>
              <p className="text-2xl font-bold">0</p>
            </Card>
          </div>

          {/* Empty State */}
          <Card className="p-12">
            <div className="text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-muted mx-auto flex items-center justify-center">
                <Database className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">No datasets yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Upload your first dataset to start generating insights with AI.
                </p>
              </div>
              <Link href="/app/upload">
                <Button>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload your first dataset
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
