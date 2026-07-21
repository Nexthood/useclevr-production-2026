import { auth } from "@/lib/auth/auth"
import { redirect } from "next/navigation"

export default async function DemoPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/register")
  }

  redirect("/app/dashboard")
}
