import { redirect } from "next/navigation"

export default async function AppCheckoutRedirect({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; discount?: string }>
}) {
  const params = await searchParams
  const query = new URLSearchParams()

  if (params.plan) query.set("plan", params.plan)
  if (params.discount) query.set("discount", params.discount)

  const suffix = query.toString()
  redirect(`/app/settings/checkout${suffix ? `?${suffix}` : ""}`)
}
