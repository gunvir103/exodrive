import { MetadataRoute } from 'next'
import { createSupabaseServiceRoleClient } from '../lib/supabase/server'
import { carServiceSupabase } from '../lib/services/car-service-supabase'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://exodrive.co'
  
  const staticRoutes = [
    {
      url: baseUrl,
      lastModified: new Date(),
      priority: 1.0
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      priority: 0.8
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      priority: 0.8
    },
    {
      url: `${baseUrl}/fleet`,
      lastModified: new Date(),
      priority: 0.9
    }
  ]
  
  const supabase = createSupabaseServiceRoleClient()
  const cars = await carServiceSupabase.getVisibleCarsForFleet(supabase)
  
  const carRoutes = cars.map(car => ({
    url: `${baseUrl}/fleet/${car.slug}`,
    lastModified: new Date(car.created_at || Date.now()),
    priority: 0.7
  }))
  
  return [...staticRoutes, ...carRoutes]
}
