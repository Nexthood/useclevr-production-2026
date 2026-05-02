import Link from "next/link"
import { CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SubscriptionSettingsPage() {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-foreground">Subscription</CardTitle>
            <CardDescription className="text-muted-foreground">Manage your plan and billing.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
          <div>
            <p className="font-medium text-foreground">Current plan</p>
            <p className="text-sm text-muted-foreground">Free tier</p>
          </div>
          <Link href="/pricing">
            <Button variant="outline" size="sm">Upgrade</Button>
          </Link>
        </div>
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
          <div>
            <p className="font-medium text-foreground">Credits used</p>
            <p className="text-sm text-muted-foreground">Usage appears here after analysis.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

