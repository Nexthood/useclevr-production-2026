import { redirect } from "next/navigation"

export const metadata = {
  title: "Business Review - UseClevr",
}

export default async function BusinessReviewPage() {
  redirect("/app/business")
}
