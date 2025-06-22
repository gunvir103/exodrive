# Error Handling Tests

This directory contains comprehensive integration tests for error handling across all API endpoints using the Bun test framework.

## Test Coverage

The error handling tests cover the following scenarios:

### 1. Invalid Request Parameters (400 Errors)
- Invalid JSON payload
- Missing required fields
- Invalid data types
- Validation errors with field-level details

### 2. Not Found Resources (404 Errors)
- Resource not found (e.g., car, booking)
- Endpoint not found

### 3. Rate Limit Exceeded (429 Errors)
- Rate limit with retry-after header
- Rate limit without retry-after

### 4. Internal Server Errors (500 Errors)
- Generic internal errors
- Database errors (including Supabase PGRST errors)
- External service errors (502)
- Cache errors

### 5. Authentication/Authorization Errors
- Unauthorized (401)
- Forbidden (403)

### 6. Conflict Errors (409)
- Resource conflicts
- Booking date conflicts

### 7. Error Response Format Consistency
- Standardized error format validation
- Required fields: code, message, timestamp, traceId
- Optional fields: details
- HTTP status codes alignment

### 8. Trace ID Generation and Uniqueness
- Unique trace ID generation for each request
- Trace ID propagation from request headers
- Trace ID in response headers

### 9. Error Logging Functionality
- Structured error logging with context
- Request metadata logging
- Stack trace preservation

## Running Tests

### Run all error handling tests:
```bash
bun test tests/integration/error-handling.test.ts
```

### Run with coverage:
```bash
bun test --coverage tests/integration/error-handling.test.ts
```

### Run specific test suites:
```bash
# Run only validation error tests
bun test tests/integration/error-handling.test.ts -t "Invalid Request Parameters"

# Run only authentication tests
bun test tests/integration/error-handling.test.ts -t "Authentication and Authorization"
```

### Run in watch mode:
```bash
bun test --watch tests/integration/error-handling.test.ts
```

## Test Structure

The tests are organized into two main sections:

1. **Unit Tests**: Test individual error handling functions and utilities
   - Error response format validation
   - Error handler behavior
   - ApiError class functionality

2. **Integration Tests**: Test error handling in mock API endpoints
   - Booking API error scenarios
   - Admin API authentication errors
   - Server error scenarios

## Environment Variables

The tests use the following environment variables (configured in `bunfig.toml`):
- `NODE_ENV=test`
- `NEXT_PUBLIC_BASE_URL=http://localhost:3000`

Additional mock variables are set in `tests/setup.ts`.

## Error Response Format

All API errors follow this standardized format:

```typescript
{
  error: {
    code: string;           // Machine-readable error code
    message: string;        // Human-readable message
    details?: any;          // Additional error details
    timestamp: string;      // ISO 8601 timestamp
    traceId: string;        // Request trace ID for debugging
  },
  status: number;          // HTTP status code
}
```

## Adding New Tests

When adding new API endpoints, ensure you test:
1. All possible error scenarios
2. Error response format consistency
3. Proper HTTP status codes
4. Trace ID generation
5. Error logging

Example test template:
```typescript
describe('New API Endpoint Errors', () => {
  it('should handle validation errors', async () => {
    // Test invalid input
  });
  
  it('should handle not found errors', async () => {
    // Test missing resources
  });
  
  it('should handle server errors', async () => {
    // Test internal failures
  });
});
```