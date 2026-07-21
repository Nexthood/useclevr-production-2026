import { auth } from "@/lib/auth/auth"
import { redirect } from "next/navigation"

export default async function StartPage() {
  const session = await auth()

  if (session?.user?.id) {
    redirect("/app/dashboard")
  }

  redirect("/register")
}
