import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Toaster } from "@/components/ui/toaster"
import { ErrorBoundary } from "@/components/error-boundary"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "exoDrive | Exotic Car Rentals in DMV",
  description: "Rent luxury and exotic cars in the DC, Maryland, and Virginia area.",
  generator: 'v0.dev',
  metadataBase: new URL('https://www.exodrive.co'),
  openGraph: {
    title: "exoDrive | Exotic Car Rentals in DMV",
    description: "Rent luxury and exotic cars in the DC, Maryland, and Virginia area.",
    url: 'https://www.exodrive.co',
    siteName: 'exoDrive',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "exoDrive | Exotic Car Rentals in DMV",
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
      </body>
    </html>
  )
}



import './globals.css'