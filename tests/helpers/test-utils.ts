import { NextRequest } from 'next/server';
import { ErrorResponse } from '@/lib/errors/api-error';
import { expect } from 'bun:test';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

/**
 * Creates a mock NextRequest object for testing
 */
export function createMockRequest(
  url: string,
  options?: RequestInit & { params?: Record<string, string> }
): NextRequest {
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
  const request = new NextRequest(new URL(fullUrl), {
    ...options,
    signal: options?.signal || undefined
  } as any);
  
  // Add params if provided
  if (options?.params) {
    Object.defineProperty(request, 'params', {
      value: options.params,
      writable: false,
    });
  }
  
  return request;
}

/**
 * Parses an error response from a Response object
 */
export async function parseErrorResponse(response: Response): Promise<ErrorResponse> {
  const json = await response.json();
  return json as ErrorResponse;
}

/**
 * Validates that an error response has the correct format
 */
export function validateErrorFormat(error: ErrorResponse['error']): void {
  // Required fields
  expect(error).toHaveProperty('code');
  expect(error).toHaveProperty('message');
  expect(error).toHaveProperty('timestamp');
  expect(error).toHaveProperty('traceId');
  
  // Type checks
  expect(typeof error.code).toBe('string');
  expect(typeof error.message).toBe('string');
  expect(typeof error.timestamp).toBe('string');
  expect(typeof error.traceId).toBe('string');
  
  // Format validations
  validateTimestamp(error.timestamp);
  validateTraceId(error.traceId);
}

/**
 * Validates ISO 8601 timestamp format
 */
export function validateTimestamp(timestamp: string): void {
  const date = new Date(timestamp);
  expect(date.toString()).not.toBe('Invalid Date');
  expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
}

/**
 * Validates trace ID format (32 character hex string)
 */
export function validateTraceId(traceId: string): void {
  expect(traceId).toMatch(/^[a-f0-9]{32}$/);
}

/**
 * Creates a mock API response
 */
export function createMockResponse(
  data: any,
  options?: ResponseInit
): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
}

/**
 * Mock fetch function for testing external API calls
 */
export function createMockFetch(responses: Map<string, Response>) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    const response = responses.get(url);
    
    if (!response) {
      return new Response('Not Found', { status: 404 });
    }
    
    return response;
  };
}

/**
 * Waits for a specific amount of time (useful for testing timeouts)
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a mock error with specific properties
 */
export function createMockError(
  message: string,
  code?: string,
  details?: any
): Error & { code?: string; details?: any } {
  const error = new Error(message) as Error & { code?: string; details?: any };
  if (code) error.code = code;
  if (details) error.details = details;
  return error;
}

/**
 * Asserts that a function throws an error with specific properties
 */
export async function expectError(
  fn: () => Promise<any>,
  expectedError: {
    message?: string;
    code?: string;
    status?: number;
  }
): Promise<void> {
  try {
    await fn();
    throw new Error('Expected function to throw an error');
  } catch (error: any) {
    if (expectedError.message) {
      expect(error.message).toBe(expectedError.message);
    }
    if (expectedError.code) {
      expect(error.code).toBe(expectedError.code);
    }
    if (expectedError.status) {
      expect(error.status).toBe(expectedError.status);
    }
  }
}

/**
 * Creates headers for authenticated requests
 */
export function createAuthHeaders(token: string): HeadersInit {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Creates headers for rate limit testing
 */
export function createRateLimitHeaders(
  remaining: number,
  reset: number
): HeadersInit {
  return {
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': reset.toString(),
  };
}