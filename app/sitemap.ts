import { MetadataRoute } from 'next'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { carServiceSupabase } from '@/lib/services/car-service-supabase'

const BASE_URL = process.env.NEXT_PUBLIC_URL || 'https://exodrive.co'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createSupabaseServiceRoleClient()
  
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/fleet`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/cars`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/policies`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ]

  try {
    const { data: cars, error } = await supabase
      .from('cars')
      .select('slug, updated_at')
      .eq('hidden', false)
      .eq('available', true)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching cars for sitemap:', error)
      return staticPages
    }

    const carPages: MetadataRoute.Sitemap = cars.map((car) => ({
      url: `${BASE_URL}/cars/${car.slug}`,
      lastModified: car.updated_at ? new Date(car.updated_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

    const fleetCarPages: MetadataRoute.Sitemap = cars.map((car) => ({
      url: `${BASE_URL}/fleet/${car.slug}`,
      lastModified: car.updated_at ? new Date(car.updated_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

    return [...staticPages, ...carPages, ...fleetCarPages]
  } catch (error) {
    console.error('Error generating sitemap:', error)
    return staticPages
  }
}