import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Toaster } from "@/components/ui/toaster"
import { ErrorBoundary } from "@/components/error-boundary"
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { MobileAnalyticsClient } from '@/components/analytics/mobile-analytics-client';
import { AnalyticsProvider } from '@/components/analytics/analytics-provider';

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "ExoDrive | Exotic Car Rentals in DMV",
  description: "Rent luxury and exotic cars in the DC, Maryland, and Virginia area.",
  generator: 'v0.dev',
  metadataBase: new URL('https://www.exodrive.co'),
  icons: {
    icon: '/exo drive.svg'
  },
  openGraph: {
    title: "ExoDrive | Exotic Car Rentals in DMV",
    description: "Rent luxury and exotic cars in the DC, Maryland, and Virginia area.",
    url: 'https://www.exodrive.co',
    siteName: 'ExoDrive',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "ExoDrive | Exotic Car Rentals in DMV",
    description: "Rent luxury and exotic cars in the DC, Maryland, and Virginia area.",
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <ErrorBoundary>
            <div className="flex min-h-screen flex-col">
              <Navbar />
              <main className="flex-1 page-transition">{children}</main>
              <Footer />
            </div>
            <Toaster />
          </ErrorBoundary>
        </Providers>
        <MobileAnalyticsClient />
        <Analytics />
        <SpeedInsights />
        <AnalyticsProvider />
      </body>
    </html>
  )
}
