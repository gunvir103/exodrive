# Error Handling Integration Tests

This test suite provides comprehensive error handling tests for all API endpoints in the Exodrive application.

## Test Coverage

The error handling tests cover:

1. **Invalid Request Parameters (400 errors)**
   - Invalid JSON payloads
   - Missing required fields
   - Invalid data types
   - Invalid UUIDs
   - Invalid date formats

2. **Not Found Resources (404 errors)**
   - Non-existent car IDs
   - Non-existent booking IDs
   - Invalid endpoints

3. **Rate Limit Exceeded (429 errors)**
   - Multiple rapid requests
   - Rate limit headers validation

4. **Internal Server Errors (500 errors)**
   - Database connection errors
   - Unexpected server errors
   - Supabase PGRST errors

5. **Validation Errors**
   - Zod schema validation
   - Custom validation logic
   - Field-level error details

6. **Error Response Format Consistency**
   - Standardized error structure
   - Trace ID generation and uniqueness
   - Error logging functionality

7. **Authentication & Authorization**
   - Missing auth headers (401)
   - Invalid tokens (403)
   - Insufficient permissions

8. **External Service Errors**
   - PayPal service failures (502)
   - Other third-party integrations

## Running the Tests

### Prerequisites

1. Ensure the API server is running on port 3005:
   ```bash
   bun dev
   ```

2. Set up test environment variables if needed:
   ```bash
   export API_BASE_URL=http://localhost:3005
   ```

### Run All Error Handling Tests

```bash
bun test:integration:errors
```

### Run Specific Test Suites

```bash
# Run only unit tests for error handling utilities
bun test tests/integration/error-handling.test.ts -t "Error Handling"

# Run only real API endpoint tests
bun test tests/integration/error-handling.test.ts -t "Real API Endpoint Error Handling Tests"

# Run tests for specific endpoints
bun test tests/integration/error-handling.test.ts -t "Cars API Endpoints"
bun test tests/integration/error-handling.test.ts -t "Bookings API Endpoints"
bun test tests/integration/error-handling.test.ts -t "Admin API Endpoints"
```

### Run with Verbose Output

```bash
bun test tests/integration/error-handling.test.ts --verbose
```

## Test Structure

The test file is organized into two main sections:

1. **Unit Tests** - Test the error handling utilities directly
   - Error response format validation
   - Error handler functions
   - Trace ID generation
   - Error logging

2. **Integration Tests** - Test actual API endpoints
   - Mock endpoint handlers for controlled testing
   - Real API endpoint testing against running server

## Expected Error Format

All API errors follow this standardized format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}, // Optional additional details
    "timestamp": "2024-01-01T00:00:00.000Z",
    "traceId": "32-character-hex-string"
  },
  "status": 400
}
```

## Customizing Tests

### Adding New Endpoint Tests

To add tests for new endpoints:

1. Add the endpoint to the appropriate describe block
2. Test various error scenarios (invalid input, missing auth, etc.)
3. Validate the error response format using `validateErrorFormat()`

### Testing Different Environments

The tests use `API_BASE_URL` environment variable (defaults to `http://localhost:3005`).

To test against different environments:

```bash
API_BASE_URL=https://staging.exodrive.com bun test:integration:errors
```

## Troubleshooting

### Common Issues

1. **Connection Refused**: Ensure the API server is running on the correct port
2. **Auth Failures**: Check that test auth tokens are properly configured
3. **Rate Limiting**: Some tests may fail if rate limits are too restrictive
4. **Database Errors**: Ensure the database is accessible and migrations are up to date

### Debug Mode

Enable debug logging by setting:

```bash
DEBUG=true bun test:integration:errors
```

## CI/CD Integration

These tests should be run as part of the CI pipeline to ensure error handling remains consistent across deployments.

Example GitHub Actions step:

```yaml
- name: Run Error Handling Tests
  run: |
    bun install
    bun dev &
    sleep 5
    bun test:integration:errors
```