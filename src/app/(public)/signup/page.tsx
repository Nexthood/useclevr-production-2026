import { redirect } from "next/navigation"

type SignupPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = (await searchParams) || {}
  const loginUrl = new URLSearchParams({ tab: "signup" })
  const callbackUrl = getParam(params.callbackUrl)
  const message = getParam(params.message)

  if (callbackUrl) {
    loginUrl.set("callbackUrl", callbackUrl)
  }

  if (message) {
    loginUrl.set("message", message)
  }

  redirect(`/login?${loginUrl.toString()}`)
}

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
