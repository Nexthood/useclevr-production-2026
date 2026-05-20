"use client"

import { Card } from "@/components/ui/card"
import { Calendar, Clock, CreditCard, Link2, User, Users, Zap } from "lucide-react"
import { useEffect, useState } from "react"

interface CustomerRow {
  id: string
  name: string | null
  email: string | null
  plan: string
  planStatus: string
  signupDate: string
  lastLogin: string | null
  referralSource: string | null
  loginCount: number
  datasets: number
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/admin/customers", { cache: "no-store" })
        if (!res.ok) throw new Error("Failed to load customers")
        const data = await res.json()
        setCustomers(data.customers || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const totals = {
    customers: customers.length,
    pro: customers.filter((c) => c.plan === "pro" || c.plan === "business").length,
    free: customers.filter((c) => c.plan === "free").length,
    active30d: customers.filter((c) => {
      if (!c.lastLogin) return false
      const diff = Date.now() - new Date(c.lastLogin).getTime()
      return diff < 30 * 24 * 60 * 60 * 1000
    }).length,
  }

  return (
    <div className="space-y-6">
      {/* Totals */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Total customers", value: totals.customers, icon: Users, color: "text-cyan-800 dark:text-cyan-100", bg: "bg-cyan-500/10" },
          { label: "Pro / Business", value: totals.pro, icon: CreditCard, color: "text-purple-800 dark:text-purple-100", bg: "bg-purple-500/10" },
          { label: "Free tier", value: totals.free, icon: User, color: "text-slate-700 dark:text-slate-300", bg: "bg-slate-500/10" },
          { label: "Active (30 d)", value: totals.active30d, icon: Zap, color: "text-emerald-800 dark:text-emerald-100", bg: "bg-emerald-500/10" },
        ].map((stat) => (
          <Card key={stat.label} className="p-4 border-border bg-card">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-bold text-foreground">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Customer table */}
      <Card className="border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Customer list</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Signup date, last login, plan, referral source, and activity.</p>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-600 dark:text-red-400">{error}</div>
        ) : customers.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No customers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Plan</th>
                  <th className="px-5 py-3 font-medium">Signup</th>
                  <th className="px-5 py-3 font-medium">Last login</th>
                  <th className="px-5 py-3 font-medium">Referral</th>
                  <th className="px-5 py-3 font-medium text-right">Logins</th>
                  <th className="px-5 py-3 font-medium text-right">Datasets</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-foreground">{c.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{c.email || "—"}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${c.plan === "free" ? "bg-slate-500/10 text-slate-700 dark:text-slate-300" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}>
                        {c.plan}
                      </span>
                      <span className="ml-1.5 text-xs text-muted-foreground">{c.planStatus}</span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {c.signupDate ? new Date(c.signupDate).toLocaleDateString() : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {c.lastLogin ? new Date(c.lastLogin).toLocaleDateString() : "Never"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Link2 className="h-3 w-3" />
                        {c.referralSource || "Direct"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-muted-foreground">{c.loginCount}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">{c.datasets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
