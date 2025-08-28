/**
 * Structured Data Schema Generators for ExoDrive
 * JSON-LD schema markup for enhanced SEO and rich snippets
 */

import type { Car } from '@/lib/types/car'
import type { AppCar } from '@/lib/services/car-service-supabase'
import { SEO_CONFIG } from './metadata'

// Base schema types
export interface BaseSchema {
  '@context': string
  '@type': string
}

export interface OrganizationSchema extends BaseSchema {
  '@type': 'Organization'
  name: string
  alternateName?: string
  url: string
  logo: string
  description: string
  contactPoint: ContactPoint[]
  address: PostalAddress
  sameAs: string[]
  foundingDate?: string
  numberOfEmployees?: string
  email: string
  telephone: string
}

export interface LocalBusinessSchema extends BaseSchema {
  '@type': 'LocalBusiness'
  name: string
  image: string[]
  '@id': string
  url: string
  telephone: string
  email: string
  address: PostalAddress
  geo: GeoCoordinates
  openingHoursSpecification: OpeningHours[]
  priceRange: string
  servesCuisine?: string
  aggregateRating?: AggregateRating
  review?: Review[]
  paymentAccepted: string
  currenciesAccepted: string
  areaServed: Place[]
  serviceType: string[]
}

export interface ProductSchema extends BaseSchema {
  '@type': 'Product'
  name: string
  image: string[]
  description: string
  sku?: string
  mpn?: string
  brand: Brand
  category: string
  offers: Offer
  aggregateRating?: AggregateRating
  review?: Review[]
  additionalProperty?: PropertyValue[]
  model?: string
  manufacturer?: Organization
}

export interface BreadcrumbListSchema extends BaseSchema {
  '@type': 'BreadcrumbList'
  itemListElement: ListItem[]
}

export interface FAQPageSchema extends BaseSchema {
  '@type': 'FAQPage'
  mainEntity: Question[]
}

// Supporting types
interface ContactPoint {
  '@type': 'ContactPoint'
  telephone: string
  email?: string
  contactType: string
  availableLanguage: string[]
  areaServed: string[]
  hoursAvailable?: OpeningHours[]
}

interface PostalAddress {
  '@type': 'PostalAddress'
  streetAddress: string
  addressLocality: string
  addressRegion: string
  postalCode: string
  addressCountry: string
}

interface GeoCoordinates {
  '@type': 'GeoCoordinates'
  latitude: number
  longitude: number
}

interface OpeningHours {
  '@type': 'OpeningHoursSpecification'
  dayOfWeek: string[]
  opens: string
  closes: string
}

interface Place {
  '@type': 'Place'
  name: string
}

interface Brand {
  '@type': 'Brand'
  name: string
}

interface Organization {
  '@type': 'Organization'
  name: string
}

interface Offer {
  '@type': 'Offer'
  price?: string
  priceCurrency: string
  availability: string
  priceValidUntil?: string
  url?: string
  seller?: Organization
  priceSpecification?: PriceSpecification
}

interface PriceSpecification {
  '@type': 'PriceSpecification'
  price: string
  priceCurrency: string
  unitCode: string
  unitText: string
}

interface AggregateRating {
  '@type': 'AggregateRating'
  ratingValue: number
  bestRating: number
  worstRating: number
  ratingCount: number
  reviewCount: number
}

interface Review {
  '@type': 'Review'
  reviewRating: Rating
  author: Person
  datePublished: string
  reviewBody?: string
  name?: string
}

interface Rating {
  '@type': 'Rating'
  ratingValue: number
  bestRating: number
  worstRating: number
}

interface Person {
  '@type': 'Person'
  name: string
}

interface PropertyValue {
  '@type': 'PropertyValue'
  name: string
  value: string
}

interface ListItem {
  '@type': 'ListItem'
  position: number
  name: string
  item: string
}

interface Question {
  '@type': 'Question'
  name: string
  acceptedAnswer: Answer
}

interface Answer {
  '@type': 'Answer'
  text: string
}

// Organization Schema Generator
export function generateOrganizationSchema(): OrganizationSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SEO_CONFIG.BUSINESS.name,
    alternateName: SEO_CONFIG.BRAND.fullName,
    url: SEO_CONFIG.BRAND.url,
    logo: `${SEO_CONFIG.BRAND.url}/logo-512.png`,
    description: SEO_CONFIG.BRAND.description,
    email: SEO_CONFIG.BUSINESS.email,
    telephone: SEO_CONFIG.BUSINESS.phone,
    foundingDate: '2020-01-01',
    numberOfEmployees: '10-50',
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: SEO_CONFIG.BUSINESS.phone,
        email: SEO_CONFIG.BUSINESS.email,
        contactType: 'customer service',
        availableLanguage: ['English'],
        areaServed: ['US-DC', 'US-MD', 'US-VA'],
        hoursAvailable: [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            opens: '09:00',
            closes: '19:00',
          },
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Saturday'],
            opens: '10:00',
            closes: '17:00',
          },
        ],
      },
    ],
    address: {
      '@type': 'PostalAddress',
      streetAddress: SEO_CONFIG.BUSINESS.address.street,
      addressLocality: SEO_CONFIG.BUSINESS.address.city,
      addressRegion: SEO_CONFIG.BUSINESS.address.state,
      postalCode: SEO_CONFIG.BUSINESS.address.zipCode,
      addressCountry: SEO_CONFIG.BUSINESS.address.country,
    },
    sameAs: [
      SEO_CONFIG.SOCIAL.instagram,
      SEO_CONFIG.SOCIAL.facebook,
      SEO_CONFIG.SOCIAL.twitter,
      SEO_CONFIG.SOCIAL.youtube,
    ],
  }
}

// Local Business Schema Generator
export function generateLocalBusinessSchema(aggregateRating?: {
  ratingValue: number
  ratingCount: number
}): LocalBusinessSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: SEO_CONFIG.BRAND.fullName,
    image: [
      `${SEO_CONFIG.BRAND.url}/images/showroom-1.jpg`,
      `${SEO_CONFIG.BRAND.url}/images/showroom-2.jpg`,
      `${SEO_CONFIG.BRAND.url}/images/fleet-collection.jpg`,
    ],
    '@id': SEO_CONFIG.BRAND.url,
    url: SEO_CONFIG.BRAND.url,
    telephone: SEO_CONFIG.BUSINESS.phone,
    email: SEO_CONFIG.BUSINESS.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: SEO_CONFIG.BUSINESS.address.street,
      addressLocality: SEO_CONFIG.BUSINESS.address.city,
      addressRegion: SEO_CONFIG.BUSINESS.address.state,
      postalCode: SEO_CONFIG.BUSINESS.address.zipCode,
      addressCountry: SEO_CONFIG.BUSINESS.address.country,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 39.0909, // Approximate coordinates for Rockville, MD
      longitude: -77.1481,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '09:00',
        closes: '19:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Saturday'],
        opens: '10:00',
        closes: '17:00',
      },
    ],
    priceRange: '$$$$',
    paymentAccepted: 'Cash, Credit Card, PayPal',
    currenciesAccepted: 'USD',
    areaServed: [
      { '@type': 'Place', name: 'Washington DC' },
      { '@type': 'Place', name: 'Maryland' },
      { '@type': 'Place', name: 'Virginia' },
      { '@type': 'Place', name: 'Rockville' },
      { '@type': 'Place', name: 'Bethesda' },
      { '@type': 'Place', name: 'Tysons' },
      { '@type': 'Place', name: 'Arlington' },
    ],
    serviceType: [
      'Exotic Car Rental',
      'Luxury Car Rental',
      'Supercar Rental',
      'Sports Car Rental',
      'Event Car Rental',
      'Wedding Car Rental',
    ],
    ...(aggregateRating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: aggregateRating.ratingValue,
        bestRating: 5,
        worstRating: 1,
        ratingCount: aggregateRating.ratingCount,
        reviewCount: aggregateRating.ratingCount,
      },
    }),
  }
}

// Product/Vehicle Schema Generator for AppCar (new version)
export function generateAppCarVehicleSchema(car: AppCar, slug: string): ProductSchema {
  const carUrl = `${SEO_CONFIG.BRAND.url}/cars/${slug}`
  const images = car.images?.map(img => img.url).filter(Boolean) || [`${SEO_CONFIG.BRAND.url}/placeholder.jpg`]
  
  // Create additional properties from car specifications
  const additionalProperties: PropertyValue[] = []
  
  // Add specifications from the specifications array
  car.specifications?.forEach(spec => {
    if (spec.name && spec.value) {
      additionalProperties.push({
        '@type': 'PropertyValue',
        name: spec.name,
        value: spec.value,
      })
    }
  })

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: car.name,
    image: images,
    description: car.description || `Experience the thrill of driving the ${car.name}, available for rent through ${SEO_CONFIG.BRAND.fullName}.`,
    sku: car.id,
    brand: {
      '@type': 'Brand',
      name: car.specifications?.find(spec => spec.name === 'Make')?.value || 'Exotic',
    },
    category: car.category || 'Exotic Car',
    ...(car.specifications?.find(spec => spec.name === 'Model') && {
      model: car.specifications.find(spec => spec.name === 'Model')?.value,
    }),
    ...(car.specifications?.find(spec => spec.name === 'Make') && {
      manufacturer: {
        '@type': 'Organization',
        name: car.specifications.find(spec => spec.name === 'Make')?.value,
      },
    }),
    offers: {
      '@type': 'Offer',
      ...(car.pricing?.base_price && { price: car.pricing.base_price.toString() }),
      priceCurrency: 'USD',
      availability: car.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: carUrl,
      seller: {
        '@type': 'Organization',
        name: SEO_CONFIG.BRAND.fullName,
      },
      ...(car.pricing?.base_price && {
        priceSpecification: {
          '@type': 'PriceSpecification',
          price: car.pricing.base_price.toString(),
          priceCurrency: 'USD',
          unitCode: 'DAY',
          unitText: 'per day',
        },
      }),
    },
    additionalProperty: additionalProperties,
  }
}

// Product/Vehicle Schema Generator (legacy version for Car interface)
export function generateVehicleSchema(car: Car, slug: string): ProductSchema {
  const carUrl = `${SEO_CONFIG.BRAND.url}/cars/${slug}`
  const images = car.imageUrls || [`${SEO_CONFIG.BRAND.url}/placeholder.jpg`]
  
  // Create additional properties from car specifications
  const additionalProperties: PropertyValue[] = []
  
  if (car.engine) {
    additionalProperties.push({
      '@type': 'PropertyValue',
      name: 'Engine',
      value: car.engine,
    })
  }
  
  if (car.horsepower) {
    additionalProperties.push({
      '@type': 'PropertyValue',
      name: 'Horsepower',
      value: car.horsepower.toString(),
    })
  }
  
  if (car.acceleration060) {
    additionalProperties.push({
      '@type': 'PropertyValue',
      name: '0-60 mph',
      value: `${car.acceleration060} seconds`,
    })
  }
  
  if (car.topSpeed) {
    additionalProperties.push({
      '@type': 'PropertyValue',
      name: 'Top Speed',
      value: `${car.topSpeed} mph`,
    })
  }
  
  if (car.transmission) {
    additionalProperties.push({
      '@type': 'PropertyValue',
      name: 'Transmission',
      value: car.transmission,
    })
  }
  
  if (car.drivetrain) {
    additionalProperties.push({
      '@type': 'PropertyValue',
      name: 'Drivetrain',
      value: car.drivetrain,
    })
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: car.name,
    image: images,
    description: car.description || `Experience the thrill of driving the ${car.name}, available for rent through ${SEO_CONFIG.BRAND.fullName}.`,
    sku: car.id,
    brand: {
      '@type': 'Brand',
      name: car.make || 'Exotic',
    },
    category: car.category,
    ...(car.model && { model: car.model }),
    ...(car.make && {
      manufacturer: {
        '@type': 'Organization',
        name: car.make,
      },
    }),
    offers: {
      '@type': 'Offer',
      ...(car.pricePerDay && { price: car.pricePerDay.toString() }),
      priceCurrency: 'USD',
      availability: car.isAvailable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: carUrl,
      seller: {
        '@type': 'Organization',
        name: SEO_CONFIG.BRAND.fullName,
      },
      ...(car.pricePerDay && {
        priceSpecification: {
          '@type': 'PriceSpecification',
          price: car.pricePerDay.toString(),
          priceCurrency: 'USD',
          unitCode: 'DAY',
          unitText: 'per day',
        },
      }),
    },
    additionalProperty: additionalProperties,
  }
}

// Breadcrumb Schema Generator
export function generateBreadcrumbSchema(breadcrumbs: Array<{ name: string; url: string }>): BreadcrumbListSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  }
}

// FAQ Schema Generator
export interface FAQItem {
  question: string
  answer: string
}

export function generateFAQSchema(faqs: FAQItem[]): FAQPageSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}

// Common FAQ items for exotic car rentals
export const COMMON_FAQS: FAQItem[] = [
  {
    question: 'What is the minimum age requirement to rent an exotic car?',
    answer: 'You must be at least 25 years old to rent an exotic or luxury vehicle from ExoDrive. All drivers must have a valid driver\'s license and meet our insurance requirements.',
  },
  {
    question: 'What documents do I need to rent an exotic car?',
    answer: 'You\'ll need a valid driver\'s license, major credit card, and proof of insurance. International drivers may need an International Driving Permit along with their home country license.',
  },
  {
    question: 'Is insurance included with exotic car rentals?',
    answer: 'Basic insurance coverage is included with all rentals. We also offer additional coverage options for enhanced protection. Please review our insurance policy details during booking.',
  },
  {
    question: 'Can you deliver the rental car to my location?',
    answer: 'Yes, we offer delivery service throughout the DMV area including Washington DC, Maryland, and Virginia. Delivery fees vary based on location and distance from our Rockville facility.',
  },
  {
    question: 'What is your cancellation policy?',
    answer: 'Cancellations made 48 hours or more before pickup receive a full refund minus processing fees. Cancellations within 48 hours may be subject to penalty fees.',
  },
  {
    question: 'Do you offer hourly or daily rental options?',
    answer: 'We offer flexible rental periods including hourly, daily, weekly, and monthly options. Minimum rental periods vary by vehicle type and season.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards, PayPal, and cash deposits. A credit card authorization is required for all rentals regardless of payment method.',
  },
  {
    question: 'Are there mileage restrictions on exotic car rentals?',
    answer: 'Daily rentals include reasonable mileage allowances. Extended rentals may have different mileage terms. Excess mileage fees apply beyond included limits.',
  },
]

// Aggregate Rating Schema Template
export function generateAggregateRatingSchema(
  ratingValue: number,
  reviewCount: number,
  bestRating: number = 5,
  worstRating: number = 1
): AggregateRating {
  return {
    '@type': 'AggregateRating',
    ratingValue: Number(ratingValue.toFixed(1)),
    bestRating,
    worstRating,
    ratingCount: reviewCount,
    reviewCount,
  }
}

// Review Schema Generator
export function generateReviewSchema(review: {
  rating: number
  author: string
  date: string
  title?: string
  content?: string
}): Review {
  return {
    '@type': 'Review',
    reviewRating: {
      '@type': 'Rating',
      ratingValue: review.rating,
      bestRating: 5,
      worstRating: 1,
    },
    author: {
      '@type': 'Person',
      name: review.author,
    },
    datePublished: review.date,
    ...(review.title && { name: review.title }),
    ...(review.content && { reviewBody: review.content }),
  }
}

// Service Schema for different rental types
export function generateServiceSchema(serviceType: 'wedding' | 'corporate' | 'photoshoot' | 'general') {
  const baseService = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: '',
    description: '',
    provider: {
      '@type': 'Organization',
      name: SEO_CONFIG.BRAND.fullName,
      url: SEO_CONFIG.BRAND.url,
    },
    areaServed: [
      { '@type': 'Place', name: 'Washington DC' },
      { '@type': 'Place', name: 'Maryland' },
      { '@type': 'Place', name: 'Virginia' },
    ],
    serviceType: 'Car Rental',
  }

  switch (serviceType) {
    case 'wedding':
      return {
        ...baseService,
        name: 'Wedding Exotic Car Rental',
        description: 'Luxury and exotic car rentals for weddings in the DMV area. Make your special day unforgettable with our premium fleet.',
        audience: {
          '@type': 'Audience',
          audienceType: 'Wedding Couples',
        },
      }
    case 'corporate':
      return {
        ...baseService,
        name: 'Corporate Luxury Car Rental',
        description: 'Professional exotic and luxury car rental services for corporate events, business travel, and executive transportation.',
        audience: {
          '@type': 'Audience',
          audienceType: 'Business Professionals',
        },
      }
    case 'photoshoot':
      return {
        ...baseService,
        name: 'Exotic Car Rental for Photography',
        description: 'Rent exotic and luxury cars for professional photoshoots, music videos, and content creation in the DMV area.',
        audience: {
          '@type': 'Audience',
          audienceType: 'Photographers and Content Creators',
        },
      }
    default:
      return {
        ...baseService,
        name: 'Exotic Car Rental Service',
        description: 'Premium exotic and luxury car rental service in Washington DC, Maryland, and Virginia.',
      }
  }
}

// Helper function to combine multiple schemas
export function combineSchemas(...schemas: BaseSchema[]): string {
  if (schemas.length === 1) {
    return JSON.stringify(schemas[0], null, 2)
  }
  
  return JSON.stringify(schemas, null, 2)
}

// Helper function to inject schema into page
export function createSchemaScript(schema: BaseSchema | BaseSchema[]): string {
  return `<script type="application/ld+json">${Array.isArray(schema) ? combineSchemas(...schema) : JSON.stringify(schema, null, 2)}</script>`
}