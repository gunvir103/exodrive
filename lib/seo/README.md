# Safe Structured Data Implementation

This implementation provides comprehensive error handling for structured data generation to ensure the ExoDrive website never breaks due to SEO metadata issues.

## Overview

The structured data system is built with multiple layers of error protection:

1. **Safe Value Extraction**: All data access uses safe wrapper functions with fallbacks
2. **Schema-Level Error Handling**: Each schema generator has try-catch blocks with fallback schemas
3. **Component-Level Error Boundaries**: React components handle render errors gracefully
4. **Validation**: All generated schemas are validated before output

## Architecture

### Core Safety Functions

```typescript
// Safe value extraction with fallbacks
function safeString(value: any, fallback: string = ''): string
function safeNumber(value: any, fallback: number = 0): number  
function safeArray<T>(value: any, fallback: T[] = []): T[]
function safeUrl(url: any, baseUrl: string): string
```

### Schema Generators

Each schema generator follows this pattern:

```typescript
// Public safe API
export function generateSchema(...): Schema | null {
  try {
    return generateSchemaUnsafe(...)
  } catch (error) {
    logSchemaError({
      message: error.message,
      context: 'generateSchema',
      timestamp: new Date()
    })
    return fallbackSchema() // or null
  }
}

// Internal unsafe implementation
function generateSchemaUnsafe(...): Schema {
  // Actual schema generation with safe value extraction
}
```

## Error Handling Strategies

### 1. Graceful Degradation

- **Primary**: Generate complete, accurate schema
- **Secondary**: Generate schema with fallback values
- **Fallback**: Return minimal valid schema
- **Last Resort**: Return null (no schema)

### 2. Never Break the Site

- All schema generation errors are caught and logged
- Invalid schemas return null instead of throwing errors  
- Rendering components check for null schemas before output
- No structured data is better than broken structured data

### 3. Comprehensive Logging

```typescript
interface SchemaError {
  message: string
  context: string
  timestamp: Date
}

// Server-side: Full error logging
// Client-side: Silent debug logging
function logSchemaError(error: SchemaError)
```

## Usage Examples

### Basic Schema Generation

```typescript
import { generateOrganizationSchema } from '@/lib/seo/structured-data'

// Safe generation - returns null on error
const schema = generateOrganizationSchema()
if (schema) {
  // Use schema safely
}
```

### React Component Usage

```typescript
import { StructuredDataScript } from '@/components/seo/structured-data-script'

function Page() {
  const schema = generateOrganizationSchema()
  
  return (
    <>
      {/* Safe rendering - handles all errors internally */}
      <StructuredDataScript schema={schema} />
      <main>{/* Page content */}</main>
    </>
  )
}
```

### Server-Side Rendering

```typescript
export default async function Layout() {
  // Safe generation with additional try-catch
  let organizationSchema = null
  try {
    organizationSchema = generateOrganizationSchema()
  } catch (error) {
    console.error('Failed to generate organization schema:', error)
  }
  
  return (
    <html>
      <head>
        {/* Only render if schema is valid */}
        {organizationSchema && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(organizationSchema, null, 2)
            }}
          />
        )}
      </head>
      <body>{children}</body>
    </html>
  )
}
```

## Error Scenarios Handled

### 1. Configuration Errors

- Missing or undefined `SEO_CONFIG`
- Invalid configuration values
- Missing environment variables

**Solution**: Fallback to hardcoded safe defaults

### 2. Data Errors

- Null or undefined car data
- Missing required fields
- Invalid data types
- Malformed arrays/objects

**Solution**: Safe value extraction with type checking and fallbacks

### 3. Network/Database Errors

- Failed data fetches
- Database connection issues
- API timeouts

**Solution**: Graceful degradation to fallback schemas

### 4. Runtime Errors

- JSON serialization errors
- Circular references
- Memory issues
- Unexpected exceptions

**Solution**: Try-catch blocks with error logging and null returns

## Testing

Comprehensive test suite covers:

- All error scenarios
- Edge cases and invalid inputs
- Fallback behavior
- Schema validation
- Error logging

Run tests:
```bash
npm test lib/seo/__tests__/structured-data-error-handling.test.ts
```

## Schema Types Supported

### 1. Organization Schema
- **Fallback**: Basic organization info with hardcoded values
- **Errors Handled**: Missing config, invalid contact info, malformed addresses

### 2. Local Business Schema  
- **Fallback**: Basic business info without ratings
- **Errors Handled**: Invalid ratings, missing geo data, malformed hours

### 3. Product/Vehicle Schema
- **Fallback**: Minimal product schema with generic info
- **Errors Handled**: Missing car data, invalid pricing, broken images, malformed specs

### 4. Breadcrumb Schema
- **Fallback**: Homepage-only breadcrumb
- **Errors Handled**: Empty breadcrumbs, invalid URLs, missing names

### 5. FAQ Schema
- **Fallback**: null (FAQ is optional)
- **Errors Handled**: Empty FAQs, invalid Q&A pairs

### 6. Review/Rating Schema
- **Fallback**: null (reviews are optional)
- **Errors Handled**: Invalid ratings, missing authors, malformed dates

## Best Practices

### 1. Always Use Safe Generators

```typescript
// ✅ Good - uses safe generation
const schema = generateOrganizationSchema()

// ❌ Bad - direct unsafe generation  
const schema = generateOrganizationSchemaUnsafe()
```

### 2. Check for Null Returns

```typescript
// ✅ Good - checks for null
const schema = generateVehicleSchema(car, slug)
if (schema) {
  renderSchema(schema)
}

// ❌ Bad - assumes schema is always valid
renderSchema(generateVehicleSchema(car, slug))
```

### 3. Use Error Boundaries in React

```typescript
// ✅ Good - uses error boundary component
<StructuredDataScript schema={schema} />

// ❌ Bad - direct rendering without error handling
<script dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />
```

### 4. Validate Before Use

```typescript
// ✅ Good - validates schema
import { validateSchema } from '@/lib/seo/structured-data'

if (validateSchema(schema)) {
  useSchema(schema)
}
```

### 5. Handle Arrays Safely

```typescript
// ✅ Good - combines safely with null filtering
const schemas = [orgSchema, breadcrumbSchema].filter(Boolean)
const combined = combineSchemas(...schemas)

// ❌ Bad - doesn't handle nulls
const combined = combineSchemas(orgSchema, breadcrumbSchema)
```

## Monitoring and Debugging

### 1. Error Logging

Errors are logged with context for debugging:

```typescript
// Server logs (full detail)
console.error('[Structured Data Error]', {
  message: 'Car data is missing',
  context: 'generateAppCarVehicleSchema(car.id: undefined, slug: test-car)',
  timestamp: '2024-01-01T12:00:00.000Z'
})

// Client logs (minimal debug info)
console.debug('[Structured Data Error]', error)
```

### 2. Debug Mode

Enable debug logging for development:

```typescript
<StructuredDataScript schema={schema} debug={true} />
```

### 3. Schema Validation

Validate generated schemas:

```typescript
import { validateSchema } from '@/lib/seo/structured-data'

const schema = generateOrganizationSchema()
if (!validateSchema(schema)) {
  console.warn('Invalid schema generated')
}
```

## Migration Guide

### From Old Implementation

1. **Update imports**: Import from the new safe structured-data module
2. **Handle null returns**: Check for null schemas before use
3. **Use React components**: Replace manual script rendering with safe components
4. **Remove try-catch**: The safe generators handle all errors internally

### Example Migration

```typescript
// Old implementation
try {
  const schema = generateOrganizationSchema()
  return (
    <script 
      type="application/ld+json"
      dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}}
    />
  )
} catch (error) {
  console.error(error)
  return null
}

// New implementation  
const schema = generateOrganizationSchema() // Already safe
return <StructuredDataScript schema={schema} />
```

## Performance Considerations

### 1. Fallback Schemas

Fallback schemas are lightweight and fast to generate, ensuring minimal performance impact even during errors.

### 2. Lazy Validation

Schema validation only occurs when explicitly requested, not during generation.

### 3. Efficient Error Handling

Error handling uses early returns and minimal processing to avoid performance penalties.

### 4. Memory Safety

All generators avoid circular references and memory leaks through safe value extraction.

## Security Considerations

### 1. XSS Prevention

All string values are sanitized through safe extraction functions before JSON serialization.

### 2. Data Validation  

Input data is validated and sanitized before use in schema generation.

### 3. Error Information

Error logs exclude sensitive information and only include safe context data.

## Conclusion

This implementation ensures that structured data generation is robust, reliable, and never breaks the ExoDrive website. The multi-layered error handling approach provides graceful degradation while maintaining SEO benefits when possible.