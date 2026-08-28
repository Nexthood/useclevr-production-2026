import type { Metadata, Viewport } from "next"
import type React from "react"
import { headers } from "next/headers"
import { Inter } from "next/font/google"
import { NoticeProvider } from "@/components/ui/notice-bar"
import { ThemeProvider } from "@/components/ui/theme-provider"
import { LanguageProvider } from "@/lib/i18n/language-context"
import { PublicClientShell } from "@/components/layout/public-client-shell"
import "./../assets/styles/globals.css"

const inter = Inter({ subsets: ["latin"], display: "swap" })

export const metadata: Metadata = {
  title: {
    default: "UseClevr",
    template: "%s | UseClevr",
  },
  description:
    "AI-powered business intelligence without the complexity. Analyze data, get insights in natural language. Free for 14 days.",
  keywords: ["AI", "business intelligence", "data analysis", "CSV", "analytics"],
  icons: {
    icon: [{ url: "/6.svg", type: "image/svg+xml" }],
    shortcut: "/6.svg",
    apple: "/6.svg",
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
    const { RootLayout, handleServerFunctions } = await import(
      "@payloadcms/next/layouts"
    )
    const payloadConfig = (await import("@payload-config")).default
    const { importMap } = await import("./(payload)/admin/importMap")

    const serverFunction = async (args: any) => {
      "use server"

      return handleServerFunctions({
        ...args,
        config: payloadConfig,
        importMap,
      })
    }

    return RootLayout({
      children,
      config: payloadConfig,
      importMap,
      serverFunction,
    })
  }

  return (
    <html lang="en" suppressHydrationWarning className={inter.className}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="flex flex-col min-h-screen transition-all duration-500 ease-in-out">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange={false}
        >
          <LanguageProvider>
            <NoticeProvider>
              <PublicClientShell>
                {children}
              </PublicClientShell>
            </NoticeProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
