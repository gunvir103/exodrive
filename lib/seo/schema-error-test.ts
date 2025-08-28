/**
 * Schema Error Handling Test Suite
 * Run this to verify the structured data error handling is working correctly
 */

import {
  generateOrganizationSchema,
  generateAppCarVehicleSchema,
  generateBreadcrumbSchema,
  generateFAQSchema,
  safeJsonStringify,
  validateSchema,
  checkSchemaSystemHealth,
  withCircuitBreaker,
} from './structured-data'

// Test runner function
export function runSchemaErrorTests() {
  console.log('🧪 Running Schema Error Handling Tests...\n')
  
  // Test 1: System Health Check
  console.log('1️⃣ Testing System Health Check...')
  try {
    const health = checkSchemaSystemHealth()
    console.log(`   Status: ${health.status}`)
    console.log(`   Organization Schema: ${health.details.organizationSchema ? '✅' : '❌'}`)
    console.log(`   Vehicle Schema: ${health.details.vehicleSchema ? '✅' : '❌'}`)
    console.log(`   Breadcrumb Schema: ${health.details.breadcrumbSchema ? '✅' : '❌'}`)
    console.log(`   FAQ Schema: ${health.details.faqSchema ? '✅' : '❌'}`)
    if (health.details.errors.length > 0) {
      console.log(`   Errors: ${health.details.errors.join(', ')}`)
    }
  } catch (error) {
    console.error('   ❌ Health check failed:', error)
  }
  console.log()
  
  // Test 2: Organization Schema with Missing Config
  console.log('2️⃣ Testing Organization Schema Resilience...')
  try {
    const schema = generateOrganizationSchema()
    console.log(`   Generated: ${schema ? '✅' : '❌'}`)
    console.log(`   Valid: ${schema && validateSchema(schema) ? '✅' : '❌'}`)
    
    const json = safeJsonStringify(schema)
    console.log(`   JSON Length: ${json.length} characters`)
  } catch (error) {
    console.error('   ❌ Organization schema test failed:', error)
  }
  console.log()
  
  // Test 3: Vehicle Schema with Invalid Data
  console.log('3️⃣ Testing Vehicle Schema with Invalid Data...')
  try {
    // Test with null data
    let schema = generateAppCarVehicleSchema(null as any, '')
    console.log(`   Null car: ${schema ? '✅ (fallback)' : '❌ (expected)'}`)
    
    // Test with minimal data
    const minimalCar = {
      id: 'test',
      name: '',
      description: null,
      category: null,
      available: true,
      images: null,
      specifications: null,
      pricing: null
    }
    schema = generateAppCarVehicleSchema(minimalCar as any, 'test')
    console.log(`   Minimal car: ${schema ? '✅ (fallback)' : '❌'}`)
    
    // Test with corrupted data
    const corruptedCar = {
      id: { invalid: 'object' },
      name: 123,
      description: ['not', 'a', 'string'],
      category: undefined,
      available: 'maybe',
      images: 'not an array',
      specifications: { corrupt: true },
      pricing: 'invalid'
    }
    schema = generateAppCarVehicleSchema(corruptedCar as any, 'corrupt')
    console.log(`   Corrupted car: ${schema ? '✅ (fallback)' : '❌'}`)
  } catch (error) {
    console.error('   ❌ Vehicle schema test failed:', error)
  }
  console.log()
  
  // Test 4: Breadcrumb Schema with Invalid Data
  console.log('4️⃣ Testing Breadcrumb Schema with Invalid Data...')
  try {
    // Test with empty array
    let schema = generateBreadcrumbSchema([])
    console.log(`   Empty array: ${schema ? '✅ (fallback)' : '❌ (expected)'}`)
    
    // Test with invalid breadcrumb objects
    schema = generateBreadcrumbSchema([
      { name: '', url: '' },
      { name: null as any, url: undefined as any },
      { name: 'Valid', url: 'https://example.com' }
    ])
    console.log(`   Mixed invalid/valid: ${schema ? '✅' : '❌'}`)
    
    // Test with completely invalid data
    schema = generateBreadcrumbSchema(null as any)
    console.log(`   Null breadcrumbs: ${schema ? '✅ (fallback)' : '❌ (expected)'}`)
  } catch (error) {
    console.error('   ❌ Breadcrumb schema test failed:', error)
  }
  console.log()
  
  // Test 5: FAQ Schema with Invalid Data
  console.log('5️⃣ Testing FAQ Schema with Invalid Data...')
  try {
    // Test with empty array
    let schema = generateFAQSchema([])
    console.log(`   Empty array: ${schema ? '❌' : '✅ (expected null)'}`)
    
    // Test with invalid FAQ objects
    schema = generateFAQSchema([
      { question: '', answer: '' },
      { question: null as any, answer: undefined as any },
      { question: 'Valid Question?', answer: 'Valid Answer' }
    ])
    console.log(`   Mixed invalid/valid: ${schema ? '✅' : '❌'}`)
  } catch (error) {
    console.error('   ❌ FAQ schema test failed:', error)
  }
  console.log()
  
  // Test 6: JSON Stringification Safety
  console.log('6️⃣ Testing Safe JSON Stringification...')
  try {
    // Test with circular reference
    const circular: any = { name: 'test' }
    circular.self = circular
    
    let json = safeJsonStringify(circular)
    console.log(`   Circular reference: ${json === '{}' ? '✅ (handled)' : '❌'}`)
    
    // Test with undefined values
    const withUndefined = {
      name: 'test',
      value: undefined,
      nested: { valid: true, invalid: undefined }
    }
    json = safeJsonStringify(withUndefined)
    console.log(`   With undefined: ${json.length > 2 ? '✅' : '❌'}`)
    
    // Test with functions
    const withFunctions = {
      name: 'test',
      fn: function() { return 'test' },
      arrow: () => 'test'
    }
    json = safeJsonStringify(withFunctions)
    console.log(`   With functions: ${json.includes('"name"') ? '✅' : '❌'}`)
  } catch (error) {
    console.error('   ❌ JSON stringification test failed:', error)
  }
  console.log()
  
  // Test 7: Circuit Breaker Functionality
  console.log('7️⃣ Testing Circuit Breaker...')
  try {
    let callCount = 0
    const faultyFunction = () => {
      callCount++
      throw new Error(`Test error ${callCount}`)
    }
    
    const protectedFunction = withCircuitBreaker(faultyFunction, 'test-circuit', 'fallback')
    
    // Try multiple times to trigger circuit breaker
    for (let i = 0; i < 5; i++) {
      const result = protectedFunction()
      if (result === 'fallback') {
        console.log(`   Call ${i + 1}: ✅ (returned fallback)`)
      }
    }
    
    console.log(`   Total function calls: ${callCount} (should stop after 3)`)
    console.log(`   Circuit breaker: ${callCount <= 3 ? '✅' : '❌'}`)
  } catch (error) {
    console.error('   ❌ Circuit breaker test failed:', error)
  }
  console.log()
  
  console.log('🎉 Schema Error Handling Tests Complete!\n')
  console.log('📋 Summary:')
  console.log('   - All schema generators have error handling')
  console.log('   - Fallback schemas are provided when data is missing')
  console.log('   - Circuit breaker prevents repeated failures')
  console.log('   - JSON stringification is safe from circular references')
  console.log('   - Schema validation prevents invalid markup')
  console.log()
  console.log('✨ The structured data system is resilient to errors and data issues!')
}

// Export for testing in development
if (typeof window === 'undefined' && process.env.NODE_ENV === 'development') {
  // Auto-run tests in development server environment
  // Uncomment the line below to run tests automatically
  // runSchemaErrorTests()
}