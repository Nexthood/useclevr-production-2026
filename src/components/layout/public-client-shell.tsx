"use client"

import dynamic from "next/dynamic"

const HelpChatbox = dynamic(
  () =>
    import("@/components/ui/help-chatbox").then((m) => m.HelpChatbox),
  { ssr: false }
)

const CookieBar = dynamic(
  () => import("@/components/ui/cookie-bar").then((m) => m.CookieBar),
  { ssr: false }
)

export function PublicClientShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <HelpChatbox audience="public" hideOnApp />
      <CookieBar />
    </>
  )
}
