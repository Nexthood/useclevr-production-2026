import { redirect } from "next/navigation";

export default async function AppDashboardAliasPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) || {}
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item) query.append(key, item)
      }
    } else if (value) {
      query.set(key, value)
    }
  }

  const suffix = query.toString()
  redirect(suffix ? `/app?${suffix}` : "/app")
}
