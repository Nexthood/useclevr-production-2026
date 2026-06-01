import { CookieBar } from "@/components/ui/cookie-bar"
import { NoticeProvider } from "@/components/ui/notice-bar"
import { ThemeProvider } from "@/components/ui/theme-provider"
import { LanguageProvider } from "@/lib/i18n/language-context"
import type { Metadata, Viewport } from "next"
import type React from "react"
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LanguageProvider>
            <NoticeProvider>
              {children}
              <CookieBar />
            </NoticeProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
