import Link from "next/link"
import { redirect } from "next/navigation"
import { ShieldCheck, Ticket } from "lucide-react"
import { AppPageHeader } from "@/components/layout/app-page-header"
import { FaqList } from "@/components/faq/faq-list"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { superAdminFaqCategories } from "@/lib/content/dashboard-faq"

export default async function SuperAdminFaqPage() {
  const session = await auth()

  if (session?.user?.role !== "superadmin") {
    redirect("/app")
  }

  return (
    <div className="min-h-screen bg-background">
      <AppPageHeader
        title="Super-admin FAQ"
        description="Operational notes for billing, tickets, access, webhooks, and incident handling."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Super-admin FAQ" },
        ]}
      />

      <main className="px-5 py-5">
        <div className="mx-auto max-w-4xl space-y-5">
          <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Operator reference
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Keep this page close when resolving tickets, reconciling billing, or checking production readiness.
              </p>
            </div>
            <Link href="/app/tickets">
              <Button className="gap-2">
                <Ticket className="h-4 w-4" />
                Ticket queue
              </Button>
            </Link>
          </Card>

          <FaqList categories={superAdminFaqCategories} />
        </div>
      </main>
    </div>
  )
}
