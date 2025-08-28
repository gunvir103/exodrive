import { MetadataRoute } from 'next'
import { withServiceRoleClient } from '@/lib/supabase/server'

// Get base URL from environment variable or fallback to production URL
const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://www.exodrive.co'

// Timeout wrapper function to prevent hanging database queries
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 5000): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error('Operation timed out after ' + timeoutMs + 'ms'))
    }, timeoutMs)
  })

  return Promise.race([promise, timeoutPromise])
}

// Fetch cars with pagination to handle large datasets
async function fetchCarsWithPagination(pageSize: number = 100): Promise<Array<{ slug: string; updated_at: string | null }>> {
  return withServiceRoleClient(async (supabase) => {
    const allCars: Array<{ slug: string; updated_at: string | null }> = []
    let pageNum = 0
    let hasMore = true

    while (hasMore) {
      console.log('Fetching cars page ' + (pageNum + 1) + '...')
      
      const queryPromise = supabase
        .from('cars')
        .select('slug, updated_at')
        .eq('available', true)
        .eq('hidden', false)
        .order('updated_at', { ascending: false })
        .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1)

      const { data: cars, error } = await withTimeout(queryPromise, 5000)

      if (error) {
        console.error('Error fetching cars page ' + (pageNum + 1) + ' for sitemap:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        throw error
      }

      if (!cars || cars.length === 0) {
        hasMore = false
        break
      }

      allCars.push(...cars)

      // If we got fewer results than the page size, we've reached the end
      if (cars.length < pageSize) {
        hasMore = false
      } else {
        pageNum++
      }

      // Safety check to prevent infinite loops
      if (pageNum > 100) {
        console.warn('Sitemap generation stopped at page 100 to prevent infinite loop')
        break
      }
    }

    console.log('Successfully fetched ' + allCars.length + ' cars across ' + (pageNum + 1) + ' page(s)')
    return allCars
  })
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages with their priorities and change frequencies
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: baseUrl + '/fleet',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: baseUrl + '/cars',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: baseUrl + '/about',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: baseUrl + '/contact',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: baseUrl + '/policies',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ]

  try {
    // Only try to fetch dynamic car pages if environment variables are available
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('Supabase environment variables not available, returning static sitemap only')
      return staticPages
    }

    console.log('Starting sitemap generation with dynamic car pages...')
    
    // Fetch dynamic car pages from the database with pagination and timeout protection
    const cars = await withTimeout(fetchCarsWithPagination(), 30000) // 30 second total timeout
    
    const carPages: MetadataRoute.Sitemap = cars.map((car) => ({
      url: baseUrl + '/cars/' + car.slug,
      lastModified: car.updated_at ? new Date(car.updated_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))

    console.log('Sitemap generation completed successfully with ' + carPages.length + ' car pages')

    // Combine static and dynamic pages
    return [...staticPages, ...carPages]
  } catch (error) {
    console.error('Error generating sitemap:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    })
    
    // Return static pages only if there's an error with dynamic content
    console.log('Falling back to static pages only due to error')
    return staticPages
  }
}