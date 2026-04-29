import { ThemeProvider } from "@/components/theme-provider"
import type { Metadata, Viewport } from "next"
import type React from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "UseClevr - AI-Powered Business Intelligence",
    template: "%s | UseClevr",
  },
  description: "AI-powered business intelligence without the complexity. Analyze data, get insights in natural language. Free for 14 days.",
  keywords: ["AI", "business intelligence", "data analysis", "CSV", "analytics"],
  icons: {
    icon: "/favicon.ico",
  },
  metadataBase: new URL("https://useclevr.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://useclevr.com",
    siteName: "UseClevr",
    title: "UseClevr - AI-Powered Business Intelligence",
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
      <head>
        {/* Next.js automatically injects meta tags here */}
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
