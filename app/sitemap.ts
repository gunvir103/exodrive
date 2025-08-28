import { MetadataRoute } from 'next'
import { withServiceRoleClient } from '@/lib/supabase/server'

const baseUrl = 'https://www.exodrive.co'

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
      url: `${baseUrl}/fleet`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/cars`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/policies`,
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

    // Fetch dynamic car pages from the database
    const carPages = await withServiceRoleClient(async (supabase) => {
      const { data: cars, error } = await supabase
        .from('cars')
        .select('slug, updated_at')
        .eq('available', true)
        .eq('hidden', false)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error fetching cars for sitemap:', error)
        return []
      }

      return (cars || []).map((car) => ({
        url: `${baseUrl}/cars/${car.slug}`,
        lastModified: car.updated_at ? new Date(car.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }))
    })

    // Combine static and dynamic pages
    return [...staticPages, ...carPages]
  } catch (error) {
    console.error('Error generating sitemap:', error)
    
    // Return static pages only if there's an error with dynamic content
    return staticPages
  }
}