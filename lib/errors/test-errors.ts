/**
 * Test file to verify error handling system
 * Run with: npx tsx lib/errors/test-errors.ts
 */

import { 
  ApiError, 
  ErrorCode,
  createNotFoundError,
  createValidationError,
  createUnauthorizedError,
  createForbiddenError,
  createConflictError,
  createRateLimitError
} from './index';

console.log('Testing ExoDrive Error Handling System\n');

// Test 1: Basic ApiError
console.log('1. Basic ApiError:');
const basicError = new ApiError(ErrorCode.INTERNAL_ERROR);
console.log(JSON.stringify(basicError.toResponse(), null, 2));
console.log('');

// Test 2: Custom message and details
console.log('2. Custom message and details:');
const customError = new ApiError(
  ErrorCode.VALIDATION_ERROR,
  'Email format is invalid',
  { field: 'email', value: 'not-an-email' }
);
console.log(JSON.stringify(customError.toResponse(), null, 2));
console.log('');

// Test 3: Utility functions
console.log('3. Utility error creators:');

const notFound = createNotFoundError('User');
console.log('Not Found:', notFound.message, '- Status:', notFound.status);

const validation = createValidationError('Password too short', { minLength: 8 });
console.log('Validation:', validation.message, '- Details:', validation.details);

const unauthorized = createUnauthorizedError('Token expired');
console.log('Unauthorized:', unauthorized.message, '- Code:', unauthorized.code);

const forbidden = createForbiddenError();
console.log('Forbidden:', forbidden.message, '- Status:', forbidden.status);

const conflict = createConflictError('Username already taken');
console.log('Conflict:', conflict.message, '- Code:', conflict.code);

const rateLimit = createRateLimitError(60);
console.log('Rate Limited:', rateLimit.message, '- Retry After:', rateLimit.details?.retryAfter);
console.log('');

// Test 4: Error type checking
console.log('4. Error type checking:');
const clientError = new ApiError(ErrorCode.NOT_FOUND);
const serverError = new ApiError(ErrorCode.DATABASE_ERROR);

console.log('404 is client error:', clientError.isClientError());
console.log('404 is server error:', clientError.isServerError());
console.log('500 is client error:', serverError.isClientError());
console.log('500 is server error:', serverError.isServerError());
console.log('');

// Test 5: Error conversion
console.log('5. Error conversion from standard Error:');
const standardError = new Error('Something went wrong');
const convertedError = ApiError.fromError(standardError);
console.log('Converted:', convertedError.message, '- Code:', convertedError.code);

const dbError = new Error('prisma connection failed');
const convertedDbError = ApiError.fromError(dbError);
console.log('DB Error:', convertedDbError.message, '- Code:', convertedDbError.code);
console.log('');

// Test 6: Trace ID generation
console.log('6. Trace ID generation:');
const error1 = new ApiError(ErrorCode.INTERNAL_ERROR);
const error2 = new ApiError(ErrorCode.INTERNAL_ERROR);
console.log('Error 1 trace ID:', error1.traceId);
console.log('Error 2 trace ID:', error2.traceId);
console.log('Trace IDs are unique:', error1.traceId !== error2.traceId);

console.log('\nAll tests completed successfully!');