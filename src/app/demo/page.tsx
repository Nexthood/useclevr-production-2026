import { auth } from "@/lib/auth/auth"
import { redirect } from "next/navigation"

export default async function DemoPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/signup?callbackUrl=%2Fdemo&message=demo")
  }

  redirect("/app")
}
