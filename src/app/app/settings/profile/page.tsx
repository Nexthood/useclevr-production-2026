import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { User } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ProfileForm } from "./profile-form"
import { isBuiltinUserId } from "@/lib/auth/builtin-users"

export default async function ProfileSettingsPage() {
  const session = await auth()
  const user = session?.user
  const db = getDb()
  let loadError: string | null = null
  let profile: { fullName: string | null; email: string | null } | null = null

  if (user?.id && !isBuiltinUserId(user.id) && db) {
    try {
      profile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, user.id),
        columns: {
          fullName: true,
          email: true,
        },
      }) ?? null
    } catch (error) {
      console.error("[Settings] Profile load failed:", error)
      loadError = "Some profile details could not be loaded. You can still view and update the account fields below."
    }
  }

  const fullName = profile?.fullName || user?.name || ""
  const email = profile?.email || user?.email || ""

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
            <User className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-foreground">Profile</CardTitle>
            <CardDescription className="text-muted-foreground">Manage the account details used across the app.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ProfileForm
          fullName={fullName}
          email={email}
          isDemo={isBuiltinUserId(user?.id)}
          loadError={loadError}
        />
      </CardContent>
    </Card>
  )
}
