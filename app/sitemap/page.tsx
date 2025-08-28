import Link from 'next/link'
import { Metadata } from 'next'
import { withServiceRoleClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Sitemap | ExoDrive Luxury & Exotic Car Rentals',
  description: 'Browse all pages and luxury car listings available on ExoDrive. Find your perfect exotic car rental quickly.',
  robots: {
    index: true,
    follow: true,
  },
}

interface Car {
  slug: string
  name: string
  brand: string
  model: string
}

async function getCarsForSitemap(): Promise<Car[]> {
  try {
    return await withServiceRoleClient(async (supabase) => {
      const { data: cars, error } = await supabase
        .from('cars')
        .select('slug, name, brand, model')
        .eq('available', true)
        .eq('hidden', false)
        .order('brand', { ascending: true })
        .order('model', { ascending: true })

      if (error) {
        console.error('Error fetching cars for HTML sitemap:', error)
        return []
      }

      return cars || []
    })
  } catch (error) {
    console.error('Failed to fetch cars for HTML sitemap:', error)
    return []
  }
}

export default async function SitemapPage() {
  const cars = await getCarsForSitemap()

  // Group cars by brand for better organization
  const carsByBrand = cars.reduce((acc, car) => {
    const brand = car.brand || 'Other'
    if (!acc[brand]) {
      acc[brand] = []
    }
    acc[brand].push(car)
    return acc
  }, {} as Record<string, Car[]>)

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">Site Map</h1>
        <p className="text-muted-foreground mb-8">
          Explore all pages and luxury vehicles available on ExoDrive. Click any link below to navigate directly to that page.
        </p>

        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-3">
          {/* Main Pages Section */}
          <div>
            <h2 className="text-2xl font-semibold mb-4 text-primary">Main Pages</h2>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-blue-600 hover:text-blue-800 underline">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/fleet" className="text-blue-600 hover:text-blue-800 underline">
                  Fleet Overview
                </Link>
              </li>
              <li>
                <Link href="/cars" className="text-blue-600 hover:text-blue-800 underline">
                  Browse All Cars
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-blue-600 hover:text-blue-800 underline">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-blue-600 hover:text-blue-800 underline">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/policies" className="text-blue-600 hover:text-blue-800 underline">
                  Policies & Terms
                </Link>
              </li>
            </ul>
          </div>

          {/* Car Collections by Brand */}
          <div className="md:col-span-2">
            <h2 className="text-2xl font-semibold mb-4 text-primary">Luxury & Exotic Cars</h2>
            
            {Object.keys(carsByBrand).length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2">
                {Object.entries(carsByBrand)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([brand, brandCars]) => (
                    <div key={brand} className="border-l-2 border-primary pl-4">
                      <h3 className="text-lg font-semibold mb-2">{brand}</h3>
                      <ul className="space-y-1">
                        {brandCars.map((car) => (
                          <li key={car.slug}>
                            <Link
                              href={`/cars/${car.slug}`}
                              className="text-blue-600 hover:text-blue-800 underline text-sm"
                            >
                              {car.name || `${car.brand} ${car.model}`}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-muted-foreground">Loading vehicle listings...</p>
            )}
          </div>
        </div>

        {/* SEO Footer Section */}
        <div className="mt-12 pt-8 border-t">
          <h2 className="text-xl font-semibold mb-4">Quick Links</h2>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link href="/sitemap.xml" className="text-blue-600 hover:text-blue-800 underline">
              XML Sitemap
            </Link>
            <Link href="/robots.txt" className="text-blue-600 hover:text-blue-800 underline">
              Robots.txt
            </Link>
            <Link href="/" className="text-blue-600 hover:text-blue-800 underline">
              Return to Homepage
            </Link>
          </div>
        </div>

        {/* Schema.org markup for better SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SiteNavigationElement',
              name: 'ExoDrive Sitemap',
              url: 'https://www.exodrive.co/sitemap',
            }),
          }}
        />
      </div>
    </div>
  )
}