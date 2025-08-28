# Structured Data Error Handling Guide

## Overview

The ExoDrive structured data system has been enhanced with comprehensive error handling to ensure that SEO markup never breaks the site, even when data is unavailable or corrupted.

## ✅ Key Features

### 1. **Safe Value Extraction**
- `safeString()` - Safely extracts strings with fallbacks
- `safeNumber()` - Safely extracts numbers with fallbacks  
- `safeArray()` - Safely extracts arrays with fallbacks
- `safeUrl()` - Safely constructs URLs with fallbacks

### 2. **Schema Validation**
- All schemas are validated before rendering
- Invalid schemas are rejected and logged
- Fallback schemas provided when main generation fails

### 3. **Error Logging**
- Structured error logging with context and timestamps
- Different logging levels for server vs client
- Detailed error tracking for debugging

### 4. **Circuit Breaker Pattern**
- Prevents repeated failures from the same schema generator
- Automatically resets after a timeout period
- Protects against cascading failures

### 5. **Safe JSON Handling**
- Protected against circular references
- Handles undefined values gracefully
- Validates JSON before rendering

## 🛡️ Error Handling Layers

### Layer 1: Input Validation
```typescript
// Safe value extraction with fallbacks
const carName = safeString(car?.name, 'Exotic Car')
const price = safeNumber(car?.pricing?.base_price, 0)
```

### Layer 2: Schema Generation
```typescript
// Try-catch around all schema generators
try {
  schema = generateVehicleSchema(car, slug)
} catch (error) {
  logSchemaError(error)
  schema = getFallbackSchema()
}
```

### Layer 3: Validation
```typescript
// Validate schema before use
if (schema && validateSchema(schema)) {
  // Use schema
} else {
  // Reject invalid schema
  schema = null
}
```

### Layer 4: JSON Serialization
```typescript
// Safe JSON stringification
const json = safeJsonStringify(schema, '{}')
if (json === '{}') {
  // Don't render empty schemas
  return null
}
```

### Layer 5: Circuit Breaker
```typescript
// Wrap functions with circuit breaker
const safeGenerator = withCircuitBreaker(
  generateVehicleSchema,
  'vehicle-schema',
  fallbackSchema
)
```

## 🔧 Usage Examples

### Layout.tsx - Organization Schema
```typescript
// Enhanced organization schema with validation
let organizationSchema = null;
let organizationSchemaJson = '';

try {
  organizationSchema = generateOrganizationSchema();
  
  if (organizationSchema && validateSchema(organizationSchema)) {
    organizationSchemaJson = safeJsonStringify(organizationSchema);
    
    if (!organizationSchemaJson || organizationSchemaJson === '{}') {
      organizationSchema = null;
    }
  }
} catch (error) {
  console.error('Failed to generate organization schema:', error);
  organizationSchema = null;
}

// Only render if valid
{organizationSchema && organizationSchemaJson && (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: organizationSchemaJson }}
  />
)}
```

### Car Page - Vehicle & Breadcrumb Schemas
```typescript
// Circuit breaker protected generators
const safeVehicleGenerator = withCircuitBreaker(
  generateAppCarVehicleSchema,
  `vehicle-schema-${carSlug}`,
  null
);

const safeBreadcrumbGenerator = withCircuitBreaker(
  generateBreadcrumbSchema,
  `breadcrumb-schema-${carSlug}`,
  null
);

// Generate with error handling
let vehicleSchema = null;
let breadcrumbSchema = null;

try {
  vehicleSchema = safeVehicleGenerator(car, carSlug);
  if (vehicleSchema && !validateSchema(vehicleSchema)) {
    vehicleSchema = null;
  }
} catch (error) {
  console.error('Vehicle schema error:', error);
}

// Safe JSON generation
const validSchemas = [vehicleSchema, breadcrumbSchema].filter(Boolean);
const schemaJson = validSchemas.length > 0 
  ? safeJsonStringify(validSchemas.length === 1 ? validSchemas[0] : validSchemas)
  : '';

// Only render if we have valid JSON
{schemaJson && (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: schemaJson }}
  />
)}
```

## 🏥 System Health Monitoring

### Health Check Function
```typescript
import { checkSchemaSystemHealth } from '@/lib/seo/structured-data'

const health = checkSchemaSystemHealth()
console.log('Schema System Status:', health.status)
// Returns: 'healthy' | 'degraded' | 'unhealthy'
```

### Running Error Tests
```typescript
import { runSchemaErrorTests } from '@/lib/seo/schema-error-test'

// Run comprehensive error handling tests
runSchemaErrorTests()
```

## 🚨 Fallback Behaviors

### When Data is Missing
- **Organization Schema**: Uses default company information
- **Vehicle Schema**: Creates minimal schema with available data
- **Breadcrumb Schema**: Returns minimal home breadcrumb
- **FAQ Schema**: Returns null (optional content)

### When Schema Generation Fails
- **Logs detailed error** with context and timestamp
- **Returns null** instead of breaking the page
- **Activates circuit breaker** to prevent repeated failures
- **Site continues to function** normally without structured data

### When JSON Serialization Fails
- **Attempts property-by-property** serialization
- **Skips problematic properties** that can't be serialized
- **Returns empty object `{}`** as safe fallback
- **Prevents script tag rendering** if JSON is invalid

## 🔍 Debugging Guide

### Error Logs
Look for these error patterns in your logs:
```
[Structured Data Error] {
  message: "Car data or slug is missing",
  context: "generateAppCarVehicleSchema(car.id: undefined, slug: )",
  timestamp: "2024-01-01T00:00:00.000Z"
}
```

### Common Issues & Solutions

**Issue**: Schema not rendering
- Check if data exists and is valid
- Verify schema passes validation
- Ensure JSON stringification succeeds

**Issue**: Circuit breaker activated
- Check error logs for root cause
- Fix underlying data issues
- Wait for automatic reset (5 minutes)

**Issue**: Invalid JSON in script tag
- Verify data doesn't contain circular references
- Check for undefined or function values
- Use `safeJsonStringify()` instead of `JSON.stringify()`

## 📊 Monitoring in Production

### Key Metrics to Track
1. **Schema Generation Success Rate** - Should be > 95%
2. **Circuit Breaker Activations** - Should be rare
3. **Fallback Schema Usage** - Monitor for data quality issues
4. **JSON Serialization Failures** - Should be near zero

### Alerting Recommendations
- Alert on schema system health status 'unhealthy'
- Alert on high circuit breaker activation rate
- Alert on repeated JSON serialization failures

## 🎯 Best Practices

1. **Always use safe value extractors** instead of direct property access
2. **Validate schemas** before rendering
3. **Use circuit breakers** for external data dependencies
4. **Provide meaningful fallbacks** for all optional data
5. **Log errors with context** for easier debugging
6. **Test error scenarios** regularly

## 🔄 Future Enhancements

- Add metrics collection for schema generation success rates
- Implement automatic fallback data refresh
- Add A/B testing for different fallback strategies
- Create dashboard for schema health monitoring