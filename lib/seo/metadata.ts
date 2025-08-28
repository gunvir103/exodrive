/**
 * SEO Metadata Infrastructure for ExoDrive
 * Comprehensive metadata generation for exotic car rental website
 */

import type { Metadata } from 'next'
import type { Car } from '@/lib/types/car'

// Site-wide constants
export const SEO_CONFIG = {
  BRAND: {
    name: 'ExoDrive',
    tagline: 'Luxury & Exotic Car Rentals in DMV',
    fullName: 'ExoDrive Exotic Car Rentals',
    description: 'Premium luxury and exotic car rental service in Washington DC, Maryland, and Virginia',
    domain: 'exodrive.co',
    url: 'https://www.exodrive.co',
  },
  BUSINESS: {
    name: 'ExoDrive LLC',
    address: {
      street: '1201 Seven Locks Rd, Suite 360',
      city: 'Rockville',
      state: 'MD',
      zipCode: '20854',
      country: 'US',
    },
    phone: '(301) 300-4609',
    email: 'exodrivexotics@gmail.com',
    hours: {
      monday: '09:00-19:00',
      tuesday: '09:00-19:00',
      wednesday: '09:00-19:00',
      thursday: '09:00-19:00',
      friday: '09:00-19:00',
      saturday: '10:00-17:00',
      sunday: 'by appointment',
    },
  },
  LOCATIONS: {
    primary: ['Washington DC', 'Maryland', 'Virginia', 'DMV area'],
    keywords: [
      'washington dc', 'dc', 'maryland', 'virginia', 'dmv', 'rockville',
      'bethesda', 'tysons', 'arlington', 'alexandria', 'fairfax',
      'silver spring', 'gaithersburg', 'potomac', 'mclean'
    ],
  },
  SOCIAL: {
    instagram: 'https://instagram.com/exodrivexotics',
    facebook: 'https://facebook.com/exodrive',
    twitter: 'https://twitter.com/exodrive',
    youtube: 'https://youtube.com/@exodrive',
  },
} as const

// Core keywords for exotic car rentals
export const KEYWORDS = {
  PRIMARY: [
    'exotic car rental', 'luxury car rental', 'supercar rental',
    'exotic car rental dc', 'luxury car rental maryland', 'supercar rental virginia',
    'exotic car rental washington dc', 'luxury car rental dmv area',
  ],
  SECONDARY: [
    'ferrari rental', 'lamborghini rental', 'mclaren rental', 'porsche rental',
    'bentley rental', 'rolls royce rental', 'aston martin rental', 'maserati rental',
    'bugatti rental', 'lotus rental', 'mercedes amg rental', 'bmw m series rental',
  ],
  LONG_TAIL: [
    'rent exotic car for special occasion', 'luxury car rental for wedding',
    'exotic car rental near me', 'supercar rental weekend',
    'exotic car rental birthday', 'luxury car rental photoshoot',
    'exotic car rental business trip', 'supercar rental anniversary',
  ],
  LOCAL: [
    'exotic car rental rockville md', 'luxury car rental bethesda',
    'supercar rental tysons corner', 'exotic car rental arlington va',
    'luxury car rental alexandria va', 'exotic car rental fairfax',
  ],
  CATEGORIES: {
    sports: ['sports car rental', 'performance car rental', 'race car rental'],
    luxury: ['luxury sedan rental', 'luxury suv rental', 'executive car rental'],
    convertible: ['convertible rental', 'convertible exotic car', 'open top luxury car'],
    supercar: ['supercar experience', 'hypercar rental', 'track car rental'],
  },
} as const

// Default metadata configurations
export const DEFAULT_METADATA = {
  openGraph: {
    type: 'website' as const,
    siteName: SEO_CONFIG.BRAND.fullName,
    locale: 'en_US',
    images: [
      {
        url: `${SEO_CONFIG.BRAND.url}/og-default.jpg`,
        width: 1200,
        height: 630,
        alt: `${SEO_CONFIG.BRAND.fullName} - ${SEO_CONFIG.BRAND.tagline}`,
        type: 'image/jpeg',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image' as const,
    site: '@exodrive',
    creator: '@exodrive',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    yandex: process.env.YANDEX_VERIFICATION,
    bing: process.env.BING_VERIFICATION,
  },
} as const

// Metadata factory functions
export interface MetadataFactoryOptions {
  title?: string
  description?: string
  keywords?: string[]
  image?: string
  canonical?: string
  noIndex?: boolean
}

export function createPageMetadata(options: MetadataFactoryOptions): Metadata {
  const {
    title,
    description,
    keywords = [],
    image,
    canonical,
    noIndex = false,
  } = options

  const metadataBase = new URL(SEO_CONFIG.BRAND.url)
  const fullTitle = title ? `${title} | ${SEO_CONFIG.BRAND.fullName}` : `${SEO_CONFIG.BRAND.fullName} - ${SEO_CONFIG.BRAND.tagline}`
  const metaDescription = description || SEO_CONFIG.BRAND.description

  const allKeywords = [
    ...KEYWORDS.PRIMARY,
    ...KEYWORDS.LOCAL,
    ...keywords,
  ].join(', ')

  return {
    metadataBase,
    title: fullTitle,
    description: metaDescription,
    keywords: allKeywords,
    authors: [{ name: SEO_CONFIG.BRAND.fullName }],
    creator: SEO_CONFIG.BRAND.fullName,
    publisher: SEO_CONFIG.BRAND.fullName,
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    openGraph: {
      ...DEFAULT_METADATA.openGraph,
      title: fullTitle,
      description: metaDescription,
      url: canonical || SEO_CONFIG.BRAND.url,
      images: image ? [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: fullTitle,
          type: 'image/jpeg',
        },
      ] : DEFAULT_METADATA.openGraph.images,
    },
    twitter: {
      ...DEFAULT_METADATA.twitter,
      title: fullTitle,
      description: metaDescription,
      images: image ? [image] : [DEFAULT_METADATA.openGraph.images[0].url],
    },
    alternates: canonical ? {
      canonical,
    } : undefined,
    robots: noIndex ? {
      index: false,
      follow: false,
    } : DEFAULT_METADATA.robots,
    other: {
      'apple-mobile-web-app-title': SEO_CONFIG.BRAND.name,
      'application-name': SEO_CONFIG.BRAND.name,
    },
  }
}

// Car-specific metadata generation
export function createCarMetadata(car: Car, slug: string): Metadata {
  const baseUrl = SEO_CONFIG.BRAND.url
  const canonical = `${baseUrl}/cars/${slug}`
  
  // Generate dynamic title based on car details
  const priceText = car.pricePerDay ? ` - $${car.pricePerDay}/day` : ''
  const yearText = car.year ? ` ${car.year}` : ''
  const title = `Rent${yearText} ${car.make || ''} ${car.model || car.name}${priceText}`
  
  // Create compelling description
  const locationKeywords = KEYWORDS.LOCAL.slice(0, 3).join(', ')
  const description = car.shortDescription || car.description || 
    `Rent the stunning${yearText} ${car.make || ''} ${car.model || car.name} in ${locationKeywords}. ${getCarCategoryDescription(car.category)} Book your exotic car rental experience today with ExoDrive.`

  // Get relevant keywords for this car
  const carKeywords = generateCarKeywords(car)
  
  // Primary image
  const primaryImage = car.imageUrls?.[0]
  
  return createPageMetadata({
    title,
    description,
    keywords: carKeywords,
    image: primaryImage,
    canonical,
  })
}

// Generate car-specific keywords
function generateCarKeywords(car: Car): string[] {
  const keywords: string[] = []
  
  // Brand-specific keywords
  if (car.make) {
    const brand = car.make.toLowerCase()
    keywords.push(
      `${brand} rental`,
      `${brand} rental dc`,
      `${brand} rental maryland`,
      `${brand} rental virginia`,
      `rent ${brand}`
    )
  }
  
  // Category-specific keywords
  const categoryKeywords = getCategoryKeywords(car.category)
  keywords.push(...categoryKeywords)
  
  // Performance-based keywords
  if (car.horsepower && car.horsepower > 500) {
    keywords.push('high performance car rental', 'supercar rental')
  }
  
  if (car.topSpeed && car.topSpeed > 200) {
    keywords.push('fast car rental', 'speed car rental')
  }
  
  // Location-based keywords
  keywords.push(...KEYWORDS.LOCAL.slice(0, 5))
  
  return keywords
}

// Get category-specific keywords
function getCategoryKeywords(category: string): string[] {
  const cat = category.toLowerCase()
  
  if (cat.includes('sports') || cat.includes('sport')) {
    return KEYWORDS.CATEGORIES.sports
  }
  if (cat.includes('luxury') || cat.includes('premium')) {
    return KEYWORDS.CATEGORIES.luxury
  }
  if (cat.includes('convertible') || cat.includes('cabrio')) {
    return KEYWORDS.CATEGORIES.convertible
  }
  if (cat.includes('super') || cat.includes('hyper')) {
    return KEYWORDS.CATEGORIES.supercar
  }
  
  return ['exotic car rental', 'luxury car rental']
}

// Get category description for SEO
function getCarCategoryDescription(category: string): string {
  const cat = category.toLowerCase()
  
  if (cat.includes('sports') || cat.includes('sport')) {
    return 'Experience the thrill of driving a high-performance sports car.'
  }
  if (cat.includes('luxury') || cat.includes('premium')) {
    return 'Enjoy the ultimate in luxury and comfort with our premium fleet.'
  }
  if (cat.includes('convertible') || cat.includes('cabrio')) {
    return 'Feel the wind in your hair with our stunning convertible collection.'
  }
  if (cat.includes('super') || cat.includes('hyper')) {
    return 'Drive the most exclusive supercars and hypercars available.'
  }
  
  return 'Experience the extraordinary with our exotic car collection.'
}

// Fleet page metadata
export function createFleetMetadata(): Metadata {
  const title = 'Exotic Car Fleet'
  const description = `Explore our extensive collection of luxury and exotic cars available for rent in ${SEO_CONFIG.LOCATIONS.primary.join(', ')}. From Ferrari and Lamborghini to McLaren and Porsche, find your perfect driving experience.`
  
  return createPageMetadata({
    title,
    description,
    keywords: [
      ...KEYWORDS.PRIMARY,
      ...KEYWORDS.SECONDARY.slice(0, 8),
      'car fleet', 'exotic car collection', 'luxury car selection'
    ],
    canonical: `${SEO_CONFIG.BRAND.url}/fleet`,
  })
}

// Booking page metadata
export function createBookingMetadata(): Metadata {
  const title = 'Book Your Exotic Car Rental'
  const description = `Book your luxury or exotic car rental in ${SEO_CONFIG.LOCATIONS.primary.join(', ')}. Easy online booking, competitive prices, and exceptional service. Reserve your dream car today with ExoDrive.`
  
  return createPageMetadata({
    title,
    description,
    keywords: [
      'book exotic car rental', 'reserve luxury car', 'exotic car booking',
      'luxury car reservation', 'rent exotic car online',
      ...KEYWORDS.LONG_TAIL.slice(0, 5)
    ],
    canonical: `${SEO_CONFIG.BRAND.url}/booking`,
  })
}

// Location-based metadata generator
export function createLocationMetadata(location: string): Metadata {
  const title = `Exotic Car Rentals in ${location}`
  const description = `Rent luxury and exotic cars in ${location}. Premium fleet of Ferraris, Lamborghinis, McLarens and more. Professional service, competitive rates, and unforgettable experiences in ${location}.`
  
  const locationKeywords = [
    `exotic car rental ${location.toLowerCase()}`,
    `luxury car rental ${location.toLowerCase()}`,
    `supercar rental ${location.toLowerCase()}`,
    `${location.toLowerCase()} exotic car rental`,
    `rent exotic car ${location.toLowerCase()}`,
  ]
  
  return createPageMetadata({
    title,
    description,
    keywords: [...locationKeywords, ...KEYWORDS.PRIMARY.slice(0, 5)],
    canonical: `${SEO_CONFIG.BRAND.url}/locations/${location.toLowerCase().replace(' ', '-')}`,
  })
}

// Dynamic title generation helpers
export function generateDynamicTitle(
  baseTitleParts: string[],
  location?: string,
  priceRange?: string
): string {
  const parts = [...baseTitleParts]
  
  if (location) {
    parts.push(`in ${location}`)
  }
  
  if (priceRange) {
    parts.push(`from ${priceRange}`)
  }
  
  return parts.join(' ')
}

// Dynamic description generation helpers
export function generateDynamicDescription(
  baseConcept: string,
  features: string[],
  location: string = 'DMV area',
  cta: string = 'Book today for an unforgettable experience.'
): string {
  const featureText = features.length > 0 ? ` ${features.slice(0, 3).join(', ')}.` : ''
  return `${baseConcept} in ${location}.${featureText} ${cta}`
}

// FAQ Schema metadata helper
export interface FAQItem {
  question: string
  answer: string
}

export function generateFAQKeywords(faqs: FAQItem[]): string[] {
  const keywords: string[] = []
  
  faqs.forEach(faq => {
    const question = faq.question.toLowerCase()
    
    if (question.includes('price') || question.includes('cost')) {
      keywords.push('exotic car rental prices', 'luxury car rental cost')
    }
    if (question.includes('age') || question.includes('old')) {
      keywords.push('age requirements exotic car rental')
    }
    if (question.includes('insurance')) {
      keywords.push('exotic car rental insurance')
    }
    if (question.includes('delivery')) {
      keywords.push('exotic car delivery service')
    }
    if (question.includes('deposit')) {
      keywords.push('exotic car rental deposit')
    }
  })
  
  return [...new Set(keywords)]
}