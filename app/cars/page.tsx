import { Metadata } from 'next'
import { CarBrowsingClient } from './components/car-browsing-client'

export const metadata: Metadata = {
  title: 'Browse Luxury & Exotic Cars | Exo Drive',
  description: 'Browse our collection of luxury and exotic cars available for rent. Filter by type, price, and features to find your perfect drive.',
  openGraph: {
    title: 'Browse Luxury & Exotic Cars | Exo Drive',
    description: 'Browse our collection of luxury and exotic cars available for rent. Filter by type, price, and features to find your perfect drive.',
    type: 'website',
  },
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