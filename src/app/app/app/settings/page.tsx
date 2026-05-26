import { redirect } from "next/navigation"

export default function LegacyNestedSettingsPage() {
  redirect("/app/settings/profile")
}
