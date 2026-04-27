import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Settings - UseClevr",
  description: "Manage your account settings",
}

export default function SettingsPage() {
  return (
    <div className="flex flex-col">
      <header className="border-b border-border/40 bg-background">
        <div className="flex h-16 items-center px-6">
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-2xl mx-auto space-y-8">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-6">Account Settings</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" defaultValue="John Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" defaultValue="john@example.com" />
              </div>
              <Button>Save changes</Button>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-6">Current Plan</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Free Plan</p>
                  <p className="text-sm text-muted-foreground">5 datasets, 100 queries/month</p>
                </div>
                <Button variant="outline">Upgrade</Button>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
