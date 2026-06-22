import payloadConfig from "@payload-config"
import { handleServerFunctions, RootLayout as PayloadRootLayout } from "@payloadcms/next/layouts"
import { CookieBar } from "@/components/ui/cookie-bar"
import { HelpChatbox } from "@/components/ui/help-chatbox"
import { NoticeProvider } from "@/components/ui/notice-bar"
import { ThemeProvider } from "@/components/ui/theme-provider"
import { LanguageProvider } from "@/lib/i18n/language-context"
import { headers } from "next/headers"
import type { Metadata, Viewport } from "next"
import type { ServerFunctionClient } from "payload"
import type React from "react"
import { importMap } from "./(payload)/admin/importMap"
import "./../assets/styles/globals.css"

export const metadata: Metadata = {
  title: {
    default: "UseClevr",
    template: "%s | UseClevr",
  },
  description:
    "AI-powered business intelligence without the complexity. Analyze data, get insights in natural language. Free for 14 days.",
  keywords: ["AI", "business intelligence", "data analysis", "CSV", "analytics"],
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
  metadataBase: new URL("https://useclevr.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://useclevr.com",
    siteName: "UseClevr",
    title: "UseClevr",
    description: "AI-powered business intelligence without the complexity.",
  },
  twitter: {
    card: "summary_large_image",
    site: "@useclevr",
    creator: "@useclevr",
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const headerStore = await headers()
  const pathname = headerStore.get("x-useclevr-pathname") || ""

  if (pathname.startsWith("/admin")) {
    const serverFunction: ServerFunctionClient = async function (args) {
      "use server"

      return handleServerFunctions({
        ...args,
        config: payloadConfig,
        importMap,
      })
    }

    return PayloadRootLayout({
      children,
      config: payloadConfig,
      importMap,
      serverFunction,
    })
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen transition-all duration-500 ease-in-out">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange={false}
        >
          <LanguageProvider>
            <NoticeProvider>
              {children}
              <HelpChatbox audience="public" hideOnApp />
              <CookieBar />
            </NoticeProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
