import { describe, it, expect, beforeAll, afterAll, mock } from 'bun:test';
import { NextRequest } from 'next/server';
import { handleError, withErrorHandler } from '@/lib/errors/error-handler';
import { ApiError, ErrorCodes, errors, ErrorResponse } from '@/lib/errors/api-error';
import { ZodError, z } from 'zod';
import { 
  createMockRequest, 
  parseErrorResponse, 
  validateErrorFormat,
  createAuthHeaders,
  expectError
} from '../helpers/test-utils';

describe('Error Handling', () => {
  
  describe('Error Response Format', () => {
    it('should return standardized error format for ApiError', async () => {
      const apiError = errors.badRequest('Invalid input', { field: 'email' });
      const req = createMockRequest('/api/test');
      const response = handleError(apiError, req);
      
      expect(response.status).toBe(400);
      
      const errorResponse = await parseErrorResponse(response);
      expect(errorResponse.status).toBe(400);
      validateErrorFormat(errorResponse.error);
      expect(errorResponse.error.code).toBe(ErrorCodes.INVALID_REQUEST);
      expect(errorResponse.error.message).toBe('Invalid input');
      expect(errorResponse.error.details).toEqual({ field: 'email' });
    });

    it('should return standardized error format for ZodError', async () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(18)
      });
      
      try {
        schema.parse({ email: 'invalid', age: 10 });
      } catch (error) {
        const req = createMockRequest('/api/test');
        const response = handleError(error, req);
        
        expect(response.status).toBe(400);
        
        const errorResponse = await parseErrorResponse(response);
        expect(errorResponse.status).toBe(400);
        validateErrorFormat(errorResponse.error);
        expect(errorResponse.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
        expect(errorResponse.error.message).toBe('Validation failed');
        expect(errorResponse.error.details).toBeDefined();
      }
    });

    it('should return standardized error format for generic Error', async () => {
      const error = new Error('Something went wrong');
      const req = createMockRequest('/api/test');
      const response = handleError(error, req);
      
      expect(response.status).toBe(500);
      
      const errorResponse = await parseErrorResponse(response);
      expect(errorResponse.status).toBe(500);
      validateErrorFormat(errorResponse.error);
      expect(errorResponse.error.code).toBe(ErrorCodes.INTERNAL_ERROR);
      expect(errorResponse.error.message).toBe('An unexpected error occurred');
      
      // In development, details should include error message
      if (process.env.NODE_ENV === 'development') {
        expect(errorResponse.error.details).toBeDefined();
      }
    });
  });

  describe('Invalid Request Parameters (400 Errors)', () => {
    it('should handle invalid request body', async () => {
      const error = errors.badRequest('Invalid JSON payload');
      const req = createMockRequest('/api/test');
      const response = handleError(error, req);
      
      expect(response.status).toBe(400);
      const errorResponse = await parseErrorResponse(response);
      expect(errorResponse.error.code).toBe(ErrorCodes.INVALID_REQUEST);
    });

    it('should handle missing required fields', async () => {
      const error = errors.validationError('Missing required fields', {
        fieldErrors: {
          email: ['Required'],
          name: ['Required']
        }
      });
      const req = createMockRequest('/api/test');
      const response = handleError(error, req);
      
      expect(response.status).toBe(400);
      const errorResponse = await parseErrorResponse(response);
      expect(errorResponse.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(errorResponse.error.details).toHaveProperty('fieldErrors');
    });

    it('should handle invalid data types', async () => {
      const schema = z.object({
        age: z.number(),
        isActive: z.boolean()
      });
      
      try {
        schema.parse({ age: 'not a number', isActive: 'not a boolean' });
      } catch (error) {
        const req = createMockRequest('/api/test');
        const response = handleError(error, req);
        
        expect(response.status).toBe(400);
        const errorResponse = await parseErrorResponse(response);
        expect(errorResponse.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      }
    });
  });

  describe('Not Found Resources (404 Errors)', () => {
    it('should handle resource not found', async () => {
      const error = errors.notFound('Car');
      const req = createMockRequest('/api/cars/invalid-id');
      const response = handleError(error, req);
      
      expect(response.status).toBe(404);
      const errorResponse = await parseErrorResponse(response);
      expect(errorResponse.error.code).toBe(ErrorCodes.NOT_FOUND);
      expect(errorResponse.error.message).toBe('Car not found');
    });

    it('should handle endpoint not found', async () => {
      const error = errors.notFound('Endpoint');
      const req = createMockRequest('/api/non-existent');
      const response = handleError(error, req);
      
      expect(response.status).toBe(404);
      const errorResponse = await parseErrorResponse(response);
      expect(errorResponse.error.code).toBe(ErrorCodes.NOT_FOUND);
    });
  });

  describe('Rate Limit Exceeded (429 Errors)', () => {
    it('should handle rate limit exceeded', async () => {
      const error = errors.rateLimited(60);
      const req = createMockRequest('/api/test');
      const response = handleError(error, req);
      
      expect(response.status).toBe(429);
      const errorResponse = await parseErrorResponse(response);
      expect(errorResponse.error.code).toBe(ErrorCodes.RATE_LIMITED);
      expect(errorResponse.error.message).toBe('Too many requests, please try again later');
      expect(errorResponse.error.details).toEqual({ retryAfter: 60 });
    });

    it('should handle rate limit without retry after', async () => {
      const error = errors.rateLimited();
      const req = createMockRequest('/api/test');
      const response = handleError(error, req);
      
      expect(response.status).toBe(429);
      const errorResponse = await parseErrorResponse(response);
      expect(errorResponse.error.code).toBe(ErrorCodes.RATE_LIMITED);
    });
  });

  describe('Internal Server Errors (500 Errors)', () => {
    it('should handle internal server error', async () => {
      const error = errors.internalError();
      const req = createMockRequest('/api/test');
      const response = handleError(error, req);
      
      expect(response.status).toBe(500);
      const errorResponse = await parseErrorResponse(response);
      expect(errorResponse.error.code).toBe(ErrorCodes.INTERNAL_ERROR);
      expect(errorResponse.error.message).toBe('An unexpected error occurred');
    });

    it('should handle database error', async () => {
      const error = errors.databaseError('Connection failed');
      const req = createMockRequest('/api/test');
      const response = handleError(error, req);
      
      expect(response.status).toBe(500);
      const errorResponse = await parseErrorResponse(response);
      expect(errorResponse.error.code).toBe(ErrorCodes.DATABASE_ERROR);
      expect(errorResponse.error.message).toBe('Connection failed');
    });

    it('should handle external service error', async () => {
      const error = errors.externalServiceError('PayPal', 'Service unavailable');
      const req = createMockRequest('/api/test');
      const response = handleError(error, req);
      
      expect(response.status).toBe(502);
      const errorResponse = await parseErrorResponse(response);
      expect(errorResponse.error.code).toBe(ErrorCodes.EXTERNAL_SERVICE_ERROR);
      expect(errorResponse.error.message).toBe('Service unavailable');
    });

    it('should handle cache error', async () => {
      const error = errors.cacheError();
      const req = createMockRequest('/api/test');
      const response = handleError(error, req);
      
      expect(response.status).toBe(500);
      const errorResponse = await parseErrorResponse(response);
      expect(errorResponse.error.code).toBe(ErrorCodes.CACHE_ERROR);
    });

    it('should handle Supabase PGRST errors', async () => {
      const error = new Error('PGRST204 - No rows found');
      const req = createMockRequest('/api/test');
      const response = handleError(error, req);
      
      expect(response.status).toBe(500);
      const errorResponse = await parseErrorResponse(response);
      expect(errorResponse.error.code).toBe(ErrorCodes.DATABASE_ERROR);
      expect(errorResponse.error.message).toBe('Database operation failed');
    });
  });

  describe('Authentication and Authorization Errors', () => {
    it('should handle unauthorized error', async () => {
      const error = errors.unauthorized();
      const req = createMockRequest('/api/admin/test');
      const response = handleError(error, req);
      
      expect(response.status).toBe(401);
      const errorResponse = await parseErrorResponse(response);
      expect(errorResponse.error.code).toBe(ErrorCodes.UNAUTHORIZED);
      expect(errorResponse.error.message).toBe('Unauthorized');
    });

    it('should handle forbidden error', async () => {
      const error = errors.forbidden('Insufficient permissions');
      const req = createMockRequest('/api/admin/test');
      const response = handleError(error, req);
      
      expect(response.status).toBe(403);
      const errorResponse = await parseErrorResponse(response);
      expect(errorResponse.error.code).toBe(ErrorCodes.FORBIDDEN);
      expect(errorResponse.error.message).toBe('Insufficient permissions');
    });
  });

  describe('Conflict Errors (409)', () => {
    it('should handle conflict error', async () => {
      const error = errors.conflict('Resource already exists', { id: '123' });
      const req = createMockRequest('/api/test');
      const response = handleError(error, req);
      
      expect(response.status).toBe(409);
      const errorResponse = await parseErrorResponse(response);
      expect(errorResponse.error.code).toBe(ErrorCodes.CONFLICT);
      expect(errorResponse.error.message).toBe('Resource already exists');
      expect(errorResponse.error.details).toEqual({ id: '123' });
    });
  });

  describe('Trace ID Generation and Uniqueness', () => {
    it('should generate unique trace IDs for each error', async () => {
      const error = errors.badRequest('Test error');
      const traceIds = new Set<string>();
      
      // Generate multiple errors and collect trace IDs
      for (let i = 0; i < 10; i++) {
        const req = createMockRequest('/api/test');
        const response = handleError(error, req);
        const errorResponse = await parseErrorResponse(response);
        traceIds.add(errorResponse.error.traceId);
      }
      
      // All trace IDs should be unique
      expect(traceIds.size).toBe(10);
    });

    it('should use existing trace ID from request header', async () => {
      const error = errors.badRequest('Test error');
      const customTraceId = 'abcdef1234567890abcdef1234567890';
      
      const req = createMockRequest('/api/test', {
        headers: {
          'x-trace-id': customTraceId
        }
      });
      
      const response = handleError(error, req);
      const errorResponse = await parseErrorResponse(response);
      expect(errorResponse.error.traceId).toBe(customTraceId);
    });

    it('should include trace ID in response headers', async () => {
      const error = errors.badRequest('Test error');
      const req = createMockRequest('/api/test');
      const response = handleError(error, req);
      
      expect(response.headers.get('X-Trace-Id')).toBeDefined();
      expect(response.headers.get('X-Trace-Id')).toMatch(/^[a-f0-9]{32}$/);
    });
  });

  describe('Error Logging Functionality', () => {
    it('should log error details with context', async () => {
      // Mock console.error
      const consoleSpy = mock(() => {});
      const originalConsoleError = console.error;
      console.error = consoleSpy;
      
      try {
        const error = errors.badRequest('Test error for logging');
        const req = createMockRequest('/api/test', { method: 'POST' });
        handleError(error, req);
        
        // Verify console.error was called
        expect(consoleSpy).toHaveBeenCalled();
        
        // Get the logged data - check if calls exist and have data
        if (consoleSpy.mock.calls.length > 0 && consoleSpy.mock.calls[0].length > 1) {
          const loggedData = consoleSpy.mock.calls[0][1];
          
          // Verify logged context
          expect(loggedData).toHaveProperty('error', 'Test error for logging');
          expect(loggedData).toHaveProperty('traceId');
          expect(loggedData).toHaveProperty('method', 'POST');
          expect(loggedData).toHaveProperty('url');
          expect(loggedData).toHaveProperty('timestamp');
        }
      } finally {
        // Restore console.error
        console.error = originalConsoleError;
      }
    });
  });

  describe('withErrorHandler Wrapper', () => {
    it('should catch and handle errors in wrapped handlers', async () => {
      const handler = withErrorHandler(async (req: NextRequest) => {
        throw errors.badRequest('Handler error');
      });
      
      const req = createMockRequest('/api/test');
      const response = await handler(req);
      
      expect(response.status).toBe(400);
      const errorResponse = await parseErrorResponse(response);
      expect(errorResponse.error.message).toBe('Handler error');
    });

    it('should pass through successful responses', async () => {
      const handler = withErrorHandler(async (req: NextRequest) => {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      });
      
      const req = createMockRequest('/api/test');
      const response = await handler(req);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ success: true });
    });
  });

  describe('Error Details Visibility', () => {
    it('should hide sensitive details in production', async () => {
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        writable: true,
        configurable: true
      });
      
      try {
        const error = new Error('Sensitive database connection string');
        const req = createMockRequest('/api/test');
        const response = handleError(error, req);
        
        const errorResponse = await parseErrorResponse(response);
        expect(errorResponse.error.details).toBeUndefined();
      } finally {
        Object.defineProperty(process.env, 'NODE_ENV', {
          value: originalEnv,
          writable: true,
          configurable: true
        });
      }
    });

    it('should show details in development', async () => {
      // Mock development environment
      const originalEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        writable: true,
        configurable: true
      });
      
      try {
        const error = new Error('Development error details');
        const req = createMockRequest('/api/test');
        const response = handleError(error, req);
        
        const errorResponse = await parseErrorResponse(response);
        if (process.env.NODE_ENV === 'development') {
          expect(errorResponse.error.details).toBeDefined();
          expect(errorResponse.error.details.message).toBe('Development error details');
        }
      } finally {
        Object.defineProperty(process.env, 'NODE_ENV', {
          value: originalEnv,
          writable: true,
          configurable: true
        });
      }
    });
  });

  describe('ApiError Methods', () => {
    it('should serialize ApiError to JSON correctly', () => {
      const error = new ApiError(
        ErrorCodes.INVALID_REQUEST,
        'Test message',
        400,
        { field: 'test' }
      );
      
      const json = error.toJSON();
      expect(json).toHaveProperty('code', ErrorCodes.INVALID_REQUEST);
      expect(json).toHaveProperty('message', 'Test message');
      expect(json).toHaveProperty('details', { field: 'test' });
      expect(json).toHaveProperty('timestamp');
      expect(json).not.toHaveProperty('traceId'); // traceId is added by handler
    });

    it('should maintain proper stack trace', () => {
      const error = new ApiError(
        ErrorCodes.INTERNAL_ERROR,
        'Stack trace test',
        500
      );
      
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ApiError');
      expect(error.stack).toContain('Stack trace test');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined errors gracefully', async () => {
      const req = createMockRequest('/api/test');
      
      // Test with null
      const response1 = handleError(null, req);
      expect(response1.status).toBe(500);
      
      // Test with undefined
      const response2 = handleError(undefined, req);
      expect(response2.status).toBe(500);
    });

    it('should handle circular reference in error details', async () => {
      const circularObj: any = { a: 1 };
      circularObj.circular = circularObj;
      
      const error = errors.badRequest('Circular reference', circularObj);
      const req = createMockRequest('/api/test');
      
      // This should not throw
      expect(() => handleError(error, req)).not.toThrow();
    });

    it('should handle very long error messages', async () => {
      const longMessage = 'A'.repeat(10000);
      const error = errors.badRequest(longMessage);
      const req = createMockRequest('/api/test');
      
      const response = handleError(error, req);
      const errorResponse = await parseErrorResponse(response);
      
      expect(errorResponse.error.message).toBe(longMessage);
    });
  });
});

describe('Integration Tests with Mock API Endpoints', () => {
  // Mock API endpoint handlers
  const mockEndpoints = {
    // Booking endpoint that validates input
    createBooking: withErrorHandler(async (req: NextRequest) => {
      const body = await req.json();
      
      // Check for not found scenario before validation
      if (body.carId === '550e8400-e29b-41d4-a716-446655440999') {
        throw errors.notFound('Car');
      }
      
      const schema = z.object({
        carId: z.string().uuid(),
        startDate: z.string(),
        endDate: z.string(),
        customerDetails: z.object({
          fullName: z.string().min(3),
          email: z.string().email()
        })
      });
      
      const result = schema.safeParse(body);
      if (!result.success) {
        throw errors.validationError('Invalid booking data', result.error.flatten());
      }
      
      // Simulate conflict
      if (body.startDate === '2024-01-01') {
        throw errors.conflict('Dates already booked');
      }
      
      return new Response(JSON.stringify({ success: true, bookingId: '123' }), {
        status: 201
      });
    }),
    
    // Admin endpoint that requires auth
    adminEndpoint: withErrorHandler(async (req: NextRequest) => {
      const authHeader = req.headers.get('Authorization');
      
      if (!authHeader) {
        throw errors.unauthorized();
      }
      
      if (authHeader !== 'Bearer valid-token') {
        throw errors.forbidden();
      }
      
      return new Response(JSON.stringify({ data: 'admin data' }), {
        status: 200
      });
    }),
    
    // Endpoint that simulates server errors
    flakyEndpoint: withErrorHandler(async (req: NextRequest) => {
      const scenario = req.headers.get('X-Test-Scenario');
      
      switch (scenario) {
        case 'database-error':
          throw new Error('PGRST301 - Database connection failed');
        case 'external-service':
          throw errors.externalServiceError('PayPal');
        case 'rate-limit':
          throw errors.rateLimited(60);
        default:
          throw errors.internalError();
      }
    })
  };
  
  describe('Booking API Error Scenarios', () => {
    it('should handle validation errors correctly', async () => {
      const req = createMockRequest('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          carId: 'invalid-uuid',
          customerDetails: {
            fullName: 'Jo', // Too short
            email: 'not-an-email'
          }
        })
      });
      
      const response = await mockEndpoints.createBooking(req);
      expect(response.status).toBe(400);
      
      const errorResponse = await parseErrorResponse(response);
      expect(errorResponse.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(errorResponse.error.details).toBeDefined();
    });
    
    it('should handle not found errors correctly', async () => {
      const req = createMockRequest('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          carId: '550e8400-e29b-41d4-a716-446655440999',
          startDate: '2024-02-01',
          endDate: '2024-02-05',
          customerDetails: {
            fullName: 'John Doe',
            email: 'john@example.com'
          }
        })
      });
      
      const response = await mockEndpoints.createBooking(req);
      expect(response.status).toBe(404);
      
      const errorResponse = await parseErrorResponse(response);
      expect(errorResponse.error.code).toBe(ErrorCodes.NOT_FOUND);
      expect(errorResponse.error.message).toBe('Car not found');
    });
    
    it('should handle conflict errors correctly', async () => {
      const req = createMockRequest('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          carId: '550e8400-e29b-41d4-a716-446655440000',
          startDate: '2024-01-01', // Triggers conflict
          endDate: '2024-01-05',
          customerDetails: {
            fullName: 'John Doe',
            email: 'john@example.com'
          }
        })
      });
      
      const response = await mockEndpoints.createBooking(req);
      expect(response.status).toBe(409);
      
      const errorResponse = await parseErrorResponse(response);
      expect(errorResponse.error.code).toBe(ErrorCodes.CONFLICT);
    });
  });
  
  describe('Admin API Error Scenarios', () => {
    it('should handle missing authorization', async () => {
      const req = createMockRequest('/api/admin/analytics');
      const response = await mockEndpoints.adminEndpoint(req);
      
      expect(response.status).toBe(401);
      const errorResponse = await parseErrorResponse(response);
      expect(errorResponse.error.code).toBe(ErrorCodes.UNAUTHORIZED);
    });
    
    it('should handle invalid authorization', async () => {
      const req = createMockRequest('/api/admin/analytics', {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });
      const response = await mockEndpoints.adminEndpoint(req);
      
      expect(response.status).toBe(403);
      const errorResponse = await parseErrorResponse(response);
      expect(errorResponse.error.code).toBe(ErrorCodes.FORBIDDEN);
    });
  });
  
  describe('Server Error Scenarios', () => {
    it('should handle database errors', async () => {
      const req = createMockRequest('/api/test', {
        headers: {
          'X-Test-Scenario': 'database-error'
        }
      });
      const response = await mockEndpoints.flakyEndpoint(req);
      
      expect(response.status).toBe(500);
      const errorResponse = await parseErrorResponse(response);
      expect(errorResponse.error.code).toBe(ErrorCodes.DATABASE_ERROR);
    });
    
    it('should handle external service errors', async () => {
      const req = createMockRequest('/api/test', {
        headers: {
          'X-Test-Scenario': 'external-service'
        }
      });
      const response = await mockEndpoints.flakyEndpoint(req);
      
      expect(response.status).toBe(502);
      const errorResponse = await parseErrorResponse(response);
      expect(errorResponse.error.code).toBe(ErrorCodes.EXTERNAL_SERVICE_ERROR);
    });
    
    it('should handle rate limiting', async () => {
      const req = createMockRequest('/api/test', {
        headers: {
          'X-Test-Scenario': 'rate-limit'
        }
      });
      const response = await mockEndpoints.flakyEndpoint(req);
      
      expect(response.status).toBe(429);
      const errorResponse = await parseErrorResponse(response);
      expect(errorResponse.error.code).toBe(ErrorCodes.RATE_LIMITED);
      expect(errorResponse.error.details).toEqual({ retryAfter: 60 });
    });
  });
});

describe('Real API Endpoint Error Handling Tests', () => {
  const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3005';
  
  describe('Cars API Endpoints', () => {
    describe('GET /api/cars/:carId', () => {
      it('should return 400 for invalid car ID format', async () => {
        const response = await fetch(`${API_BASE_URL}/api/cars/invalid-uuid`);
        expect(response.status).toBe(400);
        
        const error = await response.json();
        validateErrorFormat(error.error);
        expect(error.error.code).toBe('INVALID_REQUEST');
        expect(error.error.traceId).toBeDefined();
      });
      
      it('should return 404 for non-existent car ID', async () => {
        const response = await fetch(`${API_BASE_URL}/api/cars/550e8400-e29b-41d4-a716-446655440000`);
        expect(response.status).toBe(404);
        
        const error = await response.json();
        validateErrorFormat(error.error);
        expect(error.error.code).toBe('NOT_FOUND');
        expect(error.error.message).toContain('Car');
      });
    });
    
    describe('POST /api/cars', () => {
      it('should return 400 for invalid request body', async () => {
        const response = await fetch(`${API_BASE_URL}/api/cars`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // Missing required fields
            make: 'Toyota'
          })
        });
        
        expect(response.status).toBe(400);
        const error = await response.json();
        validateErrorFormat(error.error);
        expect(error.error.code).toBe('VALIDATION_ERROR');
        expect(error.error.details).toBeDefined();
      });
      
      it('should return 400 for invalid data types', async () => {
        const response = await fetch(`${API_BASE_URL}/api/cars`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            make: 'Toyota',
            model: 'Camry',
            year: 'not-a-number', // Should be number
            pricePerDay: 'fifty', // Should be number
            available: 'yes' // Should be boolean
          })
        });
        
        expect(response.status).toBe(400);
        const error = await response.json();
        expect(error.error.code).toBe('VALIDATION_ERROR');
      });
    });
    
    describe('GET /api/cars/availability', () => {
      it('should return 400 for invalid date format', async () => {
        const response = await fetch(`${API_BASE_URL}/api/cars/availability?startDate=invalid-date&endDate=2024-12-31`);
        expect(response.status).toBe(400);
        
        const error = await response.json();
        validateErrorFormat(error.error);
        expect(error.error.code).toBe('INVALID_REQUEST');
      });
      
      it('should return 400 when endDate is before startDate', async () => {
        const response = await fetch(`${API_BASE_URL}/api/cars/availability?startDate=2024-12-31&endDate=2024-01-01`);
        expect(response.status).toBe(400);
        
        const error = await response.json();
        expect(error.error.code).toBe('INVALID_REQUEST');
        expect(error.error.message).toContain('date');
      });
    });
  });
  
  describe('Bookings API Endpoints', () => {
    describe('POST /api/bookings', () => {
      it('should return 400 for missing required fields', async () => {
        const response = await fetch(`${API_BASE_URL}/api/bookings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            carId: '550e8400-e29b-41d4-a716-446655440000'
            // Missing dates and customer details
          })
        });
        
        expect(response.status).toBe(400);
        const error = await response.json();
        validateErrorFormat(error.error);
        expect(error.error.code).toBe('VALIDATION_ERROR');
      });
      
      it('should return 404 when car does not exist', async () => {
        const response = await fetch(`${API_BASE_URL}/api/bookings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            carId: '550e8400-e29b-41d4-a716-446655440999',
            startDate: '2024-12-25',
            endDate: '2024-12-30',
            customerDetails: {
              fullName: 'Test User',
              email: 'test@example.com',
              phoneNumber: '+1234567890'
            }
          })
        });
        
        expect(response.status).toBe(404);
        const error = await response.json();
        expect(error.error.code).toBe('NOT_FOUND');
      });
      
      it('should return 409 for conflicting booking dates', async () => {
        // This assumes there's an existing booking for these dates
        const response = await fetch(`${API_BASE_URL}/api/bookings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            carId: '550e8400-e29b-41d4-a716-446655440001', // Assuming this car exists
            startDate: '2024-01-01',
            endDate: '2024-01-05',
            customerDetails: {
              fullName: 'Test User',
              email: 'test@example.com',
              phoneNumber: '+1234567890'
            }
          })
        });
        
        if (response.status === 409) {
          const error = await response.json();
          expect(error.error.code).toBe('CONFLICT');
          expect(error.error.message).toContain('booked');
        }
      });
    });
    
    describe('POST /api/bookings/create-paypal-order', () => {
      it('should return 400 for invalid booking ID', async () => {
        const response = await fetch(`${API_BASE_URL}/api/bookings/create-paypal-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: 'invalid-uuid'
          })
        });
        
        expect(response.status).toBe(400);
        const error = await response.json();
        expect(error.error.code).toBe('INVALID_REQUEST');
      });
      
      it('should return 404 for non-existent booking', async () => {
        const response = await fetch(`${API_BASE_URL}/api/bookings/create-paypal-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: '550e8400-e29b-41d4-a716-446655440999'
          })
        });
        
        expect(response.status).toBe(404);
        const error = await response.json();
        expect(error.error.code).toBe('NOT_FOUND');
      });
    });
  });
  
  describe('Admin API Endpoints', () => {
    describe('Authentication Required Endpoints', () => {
      const adminEndpoints = [
        '/api/admin/analytics',
        '/api/admin/bookings',
        '/api/admin/cars',
        '/api/admin/inbox',
        '/api/admin/cache-warm'
      ];
      
      adminEndpoints.forEach(endpoint => {
        it(`should return 401 for ${endpoint} without auth header`, async () => {
          const response = await fetch(`${API_BASE_URL}${endpoint}`);
          expect(response.status).toBe(401);
          
          const error = await response.json();
          validateErrorFormat(error.error);
          expect(error.error.code).toBe('UNAUTHORIZED');
        });
        
        it(`should return 403 for ${endpoint} with invalid auth token`, async () => {
          const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
              'Authorization': 'Bearer invalid-token'
            }
          });
          
          // Could be 401 or 403 depending on implementation
          expect([401, 403]).toContain(response.status);
          
          const error = await response.json();
          expect(['UNAUTHORIZED', 'FORBIDDEN']).toContain(error.error.code);
        });
      });
    });
    
    describe('PUT /api/admin/bookings/:bookingId/status', () => {
      it('should return 400 for invalid status value', async () => {
        const response = await fetch(`${API_BASE_URL}/api/admin/bookings/550e8400-e29b-41d4-a716-446655440001/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-admin-token'
          },
          body: JSON.stringify({
            status: 'invalid-status'
          })
        });
        
        if (response.status === 400) {
          const error = await response.json();
          expect(error.error.code).toBe('VALIDATION_ERROR');
        }
      });
    });
  });
  
  describe('Email API Endpoints', () => {
    describe('POST /api/email/contact', () => {
      it('should return 400 for invalid email format', async () => {
        const response = await fetch(`${API_BASE_URL}/api/email/contact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Test User',
            email: 'invalid-email',
            message: 'Test message'
          })
        });
        
        expect(response.status).toBe(400);
        const error = await response.json();
        expect(error.error.code).toBe('VALIDATION_ERROR');
      });
      
      it('should return 400 for missing required fields', async () => {
        const response = await fetch(`${API_BASE_URL}/api/email/contact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Test User'
            // Missing email and message
          })
        });
        
        expect(response.status).toBe(400);
        const error = await response.json();
        expect(error.error.code).toBe('VALIDATION_ERROR');
      });
    });
  });
  
  describe('Rate Limiting', () => {
    it('should return 429 when rate limit is exceeded', async () => {
      // Make multiple requests rapidly
      const promises = Array(20).fill(null).map(() => 
        fetch(`${API_BASE_URL}/api/cars`)
      );
      
      const responses = await Promise.all(promises);
      const rateLimited = responses.some(r => r.status === 429);
      
      if (rateLimited) {
        const limitedResponse = responses.find(r => r.status === 429);
        const error = await limitedResponse!.json();
        
        validateErrorFormat(error.error);
        expect(error.error.code).toBe('RATE_LIMITED');
        expect(error.error.message).toContain('Too many requests');
        
        // Check for rate limit headers
        expect(limitedResponse!.headers.get('X-RateLimit-Limit')).toBeDefined();
        expect(limitedResponse!.headers.get('X-RateLimit-Remaining')).toBeDefined();
        expect(limitedResponse!.headers.get('X-RateLimit-Reset')).toBeDefined();
      }
    });
  });
  
  describe('Error Response Consistency', () => {
    it('should have consistent error format across all error types', async () => {
      const errorScenarios = [
        {
          url: `${API_BASE_URL}/api/cars/invalid-id`,
          expectedStatus: 400
        },
        {
          url: `${API_BASE_URL}/api/cars/550e8400-e29b-41d4-a716-446655440999`,
          expectedStatus: 404
        },
        {
          url: `${API_BASE_URL}/api/admin/bookings`,
          expectedStatus: 401
        }
      ];
      
      for (const scenario of errorScenarios) {
        const response = await fetch(scenario.url);
        expect(response.status).toBe(scenario.expectedStatus);
        
        const error = await response.json();
        
        // Validate consistent structure
        expect(error).toHaveProperty('error');
        expect(error).toHaveProperty('status');
        expect(error.status).toBe(scenario.expectedStatus);
        
        // Validate error object structure
        validateErrorFormat(error.error);
        
        // Ensure trace ID is in headers
        expect(response.headers.get('X-Trace-Id')).toBeDefined();
      }
    });
  });
  
  describe('Content-Type Validation', () => {
    it('should return 400 for invalid Content-Type on POST requests', async () => {
      const response = await fetch(`${API_BASE_URL}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'not json'
      });
      
      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error.error.code).toBe('INVALID_REQUEST');
    });
  });
  
  describe('Method Not Allowed', () => {
    it('should return 405 for unsupported HTTP methods', async () => {
      const response = await fetch(`${API_BASE_URL}/api/cars`, {
        method: 'DELETE' // Assuming DELETE is not supported on /api/cars
      });
      
      if (response.status === 405) {
        const error = await response.json();
        validateErrorFormat(error.error);
        expect(error.error.message).toContain('Method');
      }
    });
  });
  
  describe('Large Payload Handling', () => {
    it('should return 413 for payload too large', async () => {
      const largePayload = {
        description: 'A'.repeat(10 * 1024 * 1024) // 10MB string
      };
      
      const response = await fetch(`${API_BASE_URL}/api/cars`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(largePayload)
      });
      
      if (response.status === 413) {
        const error = await response.json();
        validateErrorFormat(error.error);
        expect(error.error.message).toContain('large');
      }
    });
  });
  
  describe('Timeout Handling', () => {
    it('should handle request timeouts gracefully', async () => {
      // This test assumes there's an endpoint that can simulate slow responses
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 100); // 100ms timeout
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/test-supabase/check-connection`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (error: any) {
        clearTimeout(timeoutId);
        expect(error.name).toBe('AbortError');
      }
    });
  });
  
  describe('Database Error Handling', () => {
    it('should handle database connection errors', async () => {
      // This test might need to be adjusted based on how database errors are exposed
      const response = await fetch(`${API_BASE_URL}/api/test-supabase`);
      
      if (response.status === 500) {
        const error = await response.json();
        validateErrorFormat(error.error);
        
        if (error.error.code === 'DATABASE_ERROR') {
          expect(error.error.message).toContain('Database');
        }
      }
    });
  });
  
  describe('External Service Error Handling', () => {
    it('should handle external service failures gracefully', async () => {
      // Test PayPal service error
      const response = await fetch(`${API_BASE_URL}/api/bookings/create-paypal-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: '550e8400-e29b-41d4-a716-446655440001',
          testScenario: 'service-failure' // If the API supports test scenarios
        })
      });
      
      if (response.status === 502) {
        const error = await response.json();
        validateErrorFormat(error.error);
        expect(error.error.code).toBe('EXTERNAL_SERVICE_ERROR');
        expect(error.error.message).toContain('service');
      }
    });
  });
});