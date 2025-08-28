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
import { generateOrganizationSchema, safeJsonStringify, validateSchema } from '@/lib/seo/structured-data';

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: true,
})

export const metadata: Metadata = {
  title: "ExoDrive | Exotic Car Rentals in DMV",
  description: "Rent luxury and exotic cars in the DC, Maryland, and Virginia area.",
  generator: 'v0.dev',
  metadataBase: new URL('https://www.exodrive.co'),
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
  // Generate Organization structured data for all pages with enhanced error handling
  let organizationSchema = null;
  let organizationSchemaJson = '';
  
  try {
    organizationSchema = generateOrganizationSchema();
    
    // Double-check schema validity before rendering
    if (organizationSchema && validateSchema(organizationSchema)) {
      organizationSchemaJson = safeJsonStringify(organizationSchema);
      
      // Final validation - ensure we have valid, non-empty JSON
      if (!organizationSchemaJson || organizationSchemaJson === '{}') {
        console.warn('Organization schema generated but resulted in empty JSON');
        organizationSchema = null;
        organizationSchemaJson = '';
      }
    } else {
      console.warn('Organization schema failed validation');
      organizationSchema = null;
    }
  } catch (error) {
    console.error('Failed to generate organization schema:', error);
    organizationSchema = null;
    organizationSchemaJson = '';
  }
  
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Core Web Vitals & Performance Hints */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        
        {/* Preconnect to critical domains for faster loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://vercel.live" />
        <link rel="preconnect" href="https://vitals.vercel-insights.com" />
        
        {/* DNS prefetch for secondary resources */}
        <link rel="dns-prefetch" href="//www.googletagmanager.com" />
        <link rel="dns-prefetch" href="//www.google-analytics.com" />
        <link rel="dns-prefetch" href="//cdnjs.cloudflare.com" />
        
        {/* Prefetch critical pages for better navigation */}
        <link rel="prefetch" href="/cars" />
        <link rel="prefetch" href="/fleet" />
        <link rel="prefetch" href="/booking" />
        
        {/* Security headers for SEO trust signals */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="Referrer-Policy" content="strict-origin-when-cross-origin" />
        <meta httpEquiv="Permissions-Policy" content="camera=(), microphone=(), geolocation=()" />
        
        {/* Structured data - only render if schema generation succeeded and is valid */}
        {organizationSchema && organizationSchemaJson && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: organizationSchemaJson,
            }}
          />
        )}
      </head>
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

