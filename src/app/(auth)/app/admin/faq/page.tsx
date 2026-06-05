import { redirect } from "next/navigation"

export default function SuperAdminFaqPage() {
  redirect("/app/faq?scope=operator")
}
