import type { AppCar } from './services/car-service-supabase'

export function generateCarJsonLd(car: AppCar, url: string): Record<string, any> {
  const primaryImage = car.images?.find(img => img.is_primary)?.url || car.images?.[0]?.url
  
  const makeSpec = car.specifications?.find(spec => 
    spec.name.toLowerCase() === 'make' || spec.name.toLowerCase() === 'manufacturer'
  )
  const modelSpec = car.specifications?.find(spec => spec.name.toLowerCase() === 'model')
  const yearSpec = car.specifications?.find(spec => spec.name.toLowerCase() === 'year')
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: car.name,
    description: car.short_description || car.description,
    image: primaryImage,
    brand: {
      '@type': 'Brand',
      name: makeSpec?.value || 'Exo Drive'
    },
    offers: {
      '@type': 'Offer',
      price: car.pricing?.base_price || 0,
      priceCurrency: 'USD',
      availability: car.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: url
    },
    ...(modelSpec?.value ? { model: modelSpec.value } : {}),
    ...(yearSpec?.value ? { productionDate: yearSpec.value } : {})
  }
}

export function generateOrganizationJsonLd(): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Exo Drive Exotic Car Rentals',
    url: 'https://exodrive.co',
    logo: 'https://exodrive.co/logo.png',
    sameAs: [
      'https://www.instagram.com/exodriveexotics/',
    ],
    address: {
      '@type': 'PostalAddress',
      addressRegion: 'DMV Area',
      addressCountry: 'US'
    }
  }
}
