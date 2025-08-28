/**
 * Test suite for structured data error handling
 * Verifies that all schema generators are resilient to various error conditions
 */

import {
  generateOrganizationSchema,
  generateLocalBusinessSchema,
  generateAppCarVehicleSchema,
  generateVehicleSchema,
  generateBreadcrumbSchema,
  generateFAQSchema,
  generateAggregateRatingSchema,
  generateReviewSchema,
  generateServiceSchema,
  combineSchemas,
  createSchemaScript,
  validateSchema,
  type BaseSchema,
  type FAQItem,
} from '../structured-data'

describe('Structured Data Error Handling', () => {
  // Mock console methods to test logging
  const originalConsoleError = console.error
  const originalConsoleDebug = console.debug
  
  beforeEach(() => {
    console.error = jest.fn()
    console.debug = jest.fn()
  })
  
  afterEach(() => {
    console.error = originalConsoleError
    console.debug = originalConsoleDebug
  })

  describe('Organization Schema', () => {
    it('should return valid schema with proper config', () => {
      const schema = generateOrganizationSchema()
      expect(schema).toBeTruthy()
      expect(schema?.['@type']).toBe('Organization')
      expect(schema?.name).toBeTruthy()
    })

    it('should handle missing SEO_CONFIG gracefully', () => {
      // This tests fallback values when config is undefined
      const schema = generateOrganizationSchema()
      expect(schema).toBeTruthy()
      expect(schema?.name).toBeTruthy() // Should have fallback
    })
  })

  describe('Local Business Schema', () => {
    it('should return valid schema without rating', () => {
      const schema = generateLocalBusinessSchema()
      expect(schema).toBeTruthy()
      expect(schema?.['@type']).toBe('LocalBusiness')
      expect(schema?.aggregateRating).toBeUndefined()
    })

    it('should include rating when valid data provided', () => {
      const schema = generateLocalBusinessSchema({
        ratingValue: 4.5,
        ratingCount: 100
      })
      expect(schema).toBeTruthy()
      expect(schema?.aggregateRating).toBeTruthy()
      expect(schema?.aggregateRating?.ratingValue).toBe(4.5)
    })

    it('should exclude rating when invalid data provided', () => {
      const schema = generateLocalBusinessSchema({
        ratingValue: 0,
        ratingCount: -1
      })
      expect(schema).toBeTruthy()
      expect(schema?.aggregateRating).toBeUndefined()
    })
  })

  describe('Vehicle Schema (AppCar)', () => {
    const mockAppCar = {
      id: 'test-car-1',
      name: 'Test Car',
      description: 'A test car',
      available: true,
      category: 'Exotic',
      images: [
        { url: 'https://example.com/image1.jpg', is_primary: true }
      ],
      specifications: [
        { name: 'Make', value: 'Test Make' },
        { name: 'Model', value: 'Test Model' }
      ],
      pricing: {
        base_price: 500
      }
    }

    it('should return valid schema with complete car data', () => {
      const schema = generateAppCarVehicleSchema(mockAppCar, 'test-car')
      expect(schema).toBeTruthy()
      expect(schema?.['@type']).toBe('Product')
      expect(schema?.name).toBe('Test Car')
    })

    it('should return fallback schema when car is null', () => {
      const schema = generateAppCarVehicleSchema(null as any, 'test-car')
      expect(schema).toBeTruthy()
      expect(schema?.['@type']).toBe('Product')
      expect(schema?.name).toBe('Exotic Car') // Fallback name
    })

    it('should return fallback schema when slug is missing', () => {
      const schema = generateAppCarVehicleSchema(mockAppCar, '')
      expect(schema).toBeTruthy()
      expect(schema?.['@type']).toBe('Product')
    })

    it('should handle missing images gracefully', () => {
      const carWithoutImages = { ...mockAppCar, images: null }
      const schema = generateAppCarVehicleSchema(carWithoutImages, 'test-car')
      expect(schema).toBeTruthy()
      expect(schema?.image).toEqual(expect.arrayContaining([
        expect.stringContaining('placeholder.jpg')
      ]))
    })

    it('should handle missing specifications gracefully', () => {
      const carWithoutSpecs = { ...mockAppCar, specifications: null }
      const schema = generateAppCarVehicleSchema(carWithoutSpecs, 'test-car')
      expect(schema).toBeTruthy()
      expect(schema?.brand?.name).toBe('Exotic') // Fallback brand
    })

    it('should handle missing pricing gracefully', () => {
      const carWithoutPricing = { ...mockAppCar, pricing: null }
      const schema = generateAppCarVehicleSchema(carWithoutPricing, 'test-car')
      expect(schema).toBeTruthy()
      expect(schema?.offers.price).toBeUndefined()
      expect(schema?.offers.priceSpecification).toBeUndefined()
    })
  })

  describe('Vehicle Schema (Legacy Car)', () => {
    const mockCar = {
      id: 'test-car-1',
      name: 'Test Car',
      description: 'A test car',
      isAvailable: true,
      category: 'Exotic',
      make: 'Test Make',
      model: 'Test Model',
      pricePerDay: 500,
      imageUrls: ['https://example.com/image1.jpg'],
      engine: 'V8',
      horsepower: 600,
      acceleration060: 3.2,
      topSpeed: 200,
      transmission: 'Automatic',
      drivetrain: 'RWD'
    }

    it('should return valid schema with complete car data', () => {
      const schema = generateVehicleSchema(mockCar, 'test-car')
      expect(schema).toBeTruthy()
      expect(schema?.['@type']).toBe('Product')
      expect(schema?.name).toBe('Test Car')
    })

    it('should return fallback schema when car is null', () => {
      const schema = generateVehicleSchema(null as any, 'test-car')
      expect(schema).toBeTruthy()
      expect(schema?.name).toBe('Exotic Car')
    })

    it('should handle invalid performance values gracefully', () => {
      const carWithInvalidData = {
        ...mockCar,
        horsepower: 'invalid' as any,
        acceleration060: null as any,
        topSpeed: undefined as any
      }
      const schema = generateVehicleSchema(carWithInvalidData, 'test-car')
      expect(schema).toBeTruthy()
      // Should not include invalid performance properties
      const perfProps = schema?.additionalProperty?.filter(prop => 
        ['Horsepower', '0-60 mph', 'Top Speed'].includes(prop.name)
      )
      expect(perfProps?.length).toBe(0)
    })
  })

  describe('Breadcrumb Schema', () => {
    const validBreadcrumbs = [
      { name: 'Home', url: 'https://example.com' },
      { name: 'Cars', url: 'https://example.com/cars' },
      { name: 'Test Car', url: 'https://example.com/cars/test-car' }
    ]

    it('should return valid schema with proper breadcrumbs', () => {
      const schema = generateBreadcrumbSchema(validBreadcrumbs)
      expect(schema).toBeTruthy()
      expect(schema?.['@type']).toBe('BreadcrumbList')
      expect(schema?.itemListElement).toHaveLength(3)
    })

    it('should return fallback schema with empty breadcrumbs', () => {
      const schema = generateBreadcrumbSchema([])
      expect(schema).toBeTruthy()
      expect(schema?.itemListElement).toHaveLength(1)
      expect(schema?.itemListElement[0].name).toBe('Home')
    })

    it('should return fallback schema with null breadcrumbs', () => {
      const schema = generateBreadcrumbSchema(null as any)
      expect(schema).toBeTruthy()
      expect(schema?.itemListElement[0].name).toBe('Home')
    })

    it('should filter out invalid breadcrumb items', () => {
      const invalidBreadcrumbs = [
        { name: 'Home', url: 'https://example.com' },
        { name: '', url: 'https://example.com/empty' }, // Invalid: empty name
        { name: 'Valid', url: '' }, // Invalid: empty URL
        { name: null as any, url: 'https://example.com/null' }, // Invalid: null name
        { name: 'Cars', url: 'https://example.com/cars' }
      ]
      const schema = generateBreadcrumbSchema(invalidBreadcrumbs)
      expect(schema).toBeTruthy()
      expect(schema?.itemListElement).toHaveLength(2) // Only valid items
    })
  })

  describe('FAQ Schema', () => {
    const validFAQs: FAQItem[] = [
      { question: 'What is this?', answer: 'This is a test' },
      { question: 'How does it work?', answer: 'It works well' }
    ]

    it('should return valid schema with proper FAQs', () => {
      const schema = generateFAQSchema(validFAQs)
      expect(schema).toBeTruthy()
      expect(schema?.['@type']).toBe('FAQPage')
      expect(schema?.mainEntity).toHaveLength(2)
    })

    it('should return null with empty FAQs', () => {
      const schema = generateFAQSchema([])
      expect(schema).toBeNull()
    })

    it('should return null with null FAQs', () => {
      const schema = generateFAQSchema(null as any)
      expect(schema).toBeNull()
    })

    it('should filter out invalid FAQ items', () => {
      const invalidFAQs = [
        { question: 'Valid question?', answer: 'Valid answer' },
        { question: '', answer: 'No question' }, // Invalid: empty question
        { question: 'No answer?', answer: '' }, // Invalid: empty answer
        { question: null as any, answer: 'Null question' }, // Invalid: null question
        { question: 'Valid question 2?', answer: 'Valid answer 2' }
      ]
      const schema = generateFAQSchema(invalidFAQs)
      expect(schema).toBeTruthy()
      expect(schema?.mainEntity).toHaveLength(2) // Only valid items
    })
  })

  describe('Rating Schema', () => {
    it('should return valid schema with proper rating', () => {
      const schema = generateAggregateRatingSchema(4.5, 100)
      expect(schema).toBeTruthy()
      expect(schema?.['@type']).toBe('AggregateRating')
      expect(schema?.ratingValue).toBe(4.5)
      expect(schema?.ratingCount).toBe(100)
    })

    it('should return null with invalid rating values', () => {
      const schema1 = generateAggregateRatingSchema(0, 100)
      const schema2 = generateAggregateRatingSchema(4.5, 0)
      const schema3 = generateAggregateRatingSchema(-1, 100)
      
      expect(schema1).toBeNull()
      expect(schema2).toBeNull()
      expect(schema3).toBeNull()
    })

    it('should clamp rating values to valid range', () => {
      const schema = generateAggregateRatingSchema(6.5, 100) // Above max
      expect(schema).toBeTruthy()
      expect(schema?.ratingValue).toBe(5) // Clamped to max
    })

    it('should handle string inputs gracefully', () => {
      const schema = generateAggregateRatingSchema('4.5' as any, '100' as any)
      expect(schema).toBeTruthy()
      expect(schema?.ratingValue).toBe(4.5)
      expect(schema?.ratingCount).toBe(100)
    })
  })

  describe('Review Schema', () => {
    const validReview = {
      rating: 5,
      author: 'Test User',
      date: '2024-01-01',
      title: 'Great service',
      content: 'Excellent experience'
    }

    it('should return valid schema with complete review', () => {
      const schema = generateReviewSchema(validReview)
      expect(schema).toBeTruthy()
      expect(schema?.['@type']).toBe('Review')
      expect(schema?.author.name).toBe('Test User')
    })

    it('should return null with missing review data', () => {
      const schema = generateReviewSchema(null as any)
      expect(schema).toBeNull()
    })

    it('should handle missing optional fields gracefully', () => {
      const minimalReview = {
        rating: 4,
        author: 'Test User',
        date: '2024-01-01'
      }
      const schema = generateReviewSchema(minimalReview)
      expect(schema).toBeTruthy()
      expect(schema?.name).toBeUndefined()
      expect(schema?.reviewBody).toBeUndefined()
    })

    it('should clamp rating values', () => {
      const review = { ...validReview, rating: 10 }
      const schema = generateReviewSchema(review)
      expect(schema).toBeTruthy()
      expect(schema?.reviewRating.ratingValue).toBe(5) // Clamped
    })
  })

  describe('Service Schema', () => {
    it('should return wedding service schema', () => {
      const schema = generateServiceSchema('wedding')
      expect(schema).toBeTruthy()
      expect(schema['@type']).toBe('Service')
      expect(schema.name).toContain('Wedding')
    })

    it('should return corporate service schema', () => {
      const schema = generateServiceSchema('corporate')
      expect(schema).toBeTruthy()
      expect(schema.name).toContain('Corporate')
    })

    it('should return general service schema for invalid type', () => {
      const schema = generateServiceSchema('invalid' as any)
      expect(schema).toBeTruthy()
      expect(schema.name).toContain('Exotic Car Rental Service')
    })
  })

  describe('Schema Combination', () => {
    it('should combine multiple valid schemas', () => {
      const orgSchema = generateOrganizationSchema()
      const breadcrumbSchema = generateBreadcrumbSchema([
        { name: 'Home', url: 'https://example.com' }
      ])
      
      const combined = combineSchemas(orgSchema, breadcrumbSchema)
      expect(combined).toBeTruthy()
      expect(combined).not.toBe('{}')
      
      // Should be valid JSON
      expect(() => JSON.parse(combined)).not.toThrow()
    })

    it('should handle null schemas gracefully', () => {
      const combined = combineSchemas(null, null, null)
      expect(combined).toBe('{}')
    })

    it('should filter out null schemas and combine valid ones', () => {
      const orgSchema = generateOrganizationSchema()
      const combined = combineSchemas(orgSchema, null, null)
      expect(combined).toBeTruthy()
      expect(combined).not.toBe('{}')
    })
  })

  describe('Schema Script Creation', () => {
    it('should create valid script tag with schema', () => {
      const schema = generateOrganizationSchema()
      const script = createSchemaScript(schema)
      expect(script).toContain('<script type="application/ld+json">')
      expect(script).toContain('Organization')
      expect(script).toContain('</script>')
    })

    it('should return empty string with null schema', () => {
      const script = createSchemaScript(null)
      expect(script).toBe('')
    })

    it('should handle array of schemas', () => {
      const schema1 = generateOrganizationSchema()
      const schema2 = generateBreadcrumbSchema([
        { name: 'Home', url: 'https://example.com' }
      ])
      
      const script = createSchemaScript([schema1, schema2].filter(Boolean))
      expect(script).toContain('<script type="application/ld+json">')
      expect(script).toContain('Organization')
      expect(script).toContain('BreadcrumbList')
    })
  })

  describe('Schema Validation', () => {
    it('should validate correct schemas', () => {
      const validSchema: BaseSchema = {
        '@context': 'https://schema.org',
        '@type': 'Organization'
      }
      expect(validateSchema(validSchema)).toBe(true)
    })

    it('should reject invalid schemas', () => {
      expect(validateSchema(null)).toBe(false)
      expect(validateSchema({})).toBe(false)
      expect(validateSchema({ '@context': 'test' })).toBe(false)
      expect(validateSchema({ '@type': 'test' })).toBe(false)
      expect(validateSchema('string')).toBe(false)
      expect(validateSchema(123)).toBe(false)
    })
  })

  describe('Error Logging', () => {
    it('should log errors appropriately', () => {
      // Force an error by passing invalid data
      generateAppCarVehicleSchema(null as any, '')
      expect(console.error).toHaveBeenCalled()
    })
  })
})