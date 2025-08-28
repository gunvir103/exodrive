import { Metadata } from 'next'
import { CarBrowsingClient } from './components/car-browsing-client'
import { createPageMetadata, KEYWORDS, SEO_CONFIG, generateDynamicDescription } from "@/lib/seo/metadata"

// Generate enhanced metadata for Cars browse page
export async function generateMetadata(): Promise<Metadata> {
  const title = "Browse Exotic & Luxury Cars | Ferrari, Lamborghini, McLaren"
  const description = generateDynamicDescription(
    "Discover and filter through our premium collection of exotic and luxury rental cars",
    [
      "Advanced filtering by brand, price, and features",
      "Real-time availability checking", 
      "Instant booking with competitive rates",
      "Professional delivery across DMV area"
    ],
    "Washington DC, Maryland, and Virginia",
    "Find and reserve your perfect exotic car experience today."
  )

  return createPageMetadata({
    title,
    description,
    keywords: [
      'browse exotic cars',
      'luxury car selection',
      'filter rental cars',
      'exotic car inventory',
      'luxury car browse',
      'car rental search',
      'exotic car finder',
      'luxury car catalog',
      'supercar browser',
      'exotic car availability',
      'rental car filtering',
      'luxury car comparison',
      ...KEYWORDS.PRIMARY,
      ...KEYWORDS.SECONDARY.slice(0, 8),
      'car rental inventory search',
      'exotic car rental selection',
      'luxury car rental browser'
    ],
    canonical: `${SEO_CONFIG.BRAND.url}/cars`,
    image: `${SEO_CONFIG.BRAND.url}/og-cars.jpg`
  })
}

// Server component that renders the car browsing page
export default async function CarsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  // Parse search parameters for initial state
  const initialFilters = {
    search: typeof searchParams.search === 'string' ? searchParams.search : '',
    category: typeof searchParams.category === 'string' ? searchParams.category : '',
    minPrice: typeof searchParams.minPrice === 'string' ? parseInt(searchParams.minPrice) : null,
    maxPrice: typeof searchParams.maxPrice === 'string' ? parseInt(searchParams.maxPrice) : null,
    features: typeof searchParams.features === 'string' ? searchParams.features.split(',').filter(Boolean) : [],
    sortBy: typeof searchParams.sortBy === 'string' ? searchParams.sortBy : 'featured',
    sortOrder: typeof searchParams.sortOrder === 'string' ? searchParams.sortOrder : 'desc',
    page: typeof searchParams.page === 'string' ? parseInt(searchParams.page) : 1,
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">Browse Our Fleet</h1>
          <p className="text-lg text-muted-foreground">
            Discover luxury and exotic cars available for rent. Use the filters below to find your perfect drive.
          </p>
        </div>
        
        <CarBrowsingClient initialFilters={initialFilters} />
      </div>
    </div>
  )
}