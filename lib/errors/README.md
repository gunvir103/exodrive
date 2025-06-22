# ExoDrive Error Handling System

This directory contains the standardized error handling implementation for the ExoDrive project.

## Structure

- `api-error.ts` - Custom error class and error codes
- `error-handler.ts` - Centralized error handling logic
- `error-middleware.ts` - Next.js App Router middleware utilities
- `index.ts` - Main export file

## Usage Examples

### Basic API Route with Error Handling

```typescript
// app/api/users/[id]/route.ts
import { NextRequest } from 'next/server';
import { withErrorHandler, createNotFoundError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

export const GET = withErrorHandler(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const user = await prisma.user.findUnique({
      where: { id: params.id }
    });
    
    if (!user) {
      throw createNotFoundError('User');
    }
    
    return NextResponse.json({ data: user });
  },
  { operation: 'getUser' }
);
```

### Request Validation

```typescript
// app/api/files/upload/route.ts
import { NextRequest } from 'next/server';
import { validateRequestBody, createValidationError } from '@/lib/errors';

interface UploadRequest {
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export const POST = withErrorHandler(
  async (request: NextRequest) => {
    const body = await validateRequestBody<UploadRequest>(request, (data) => {
      if (!data.fileName || typeof data.fileName !== 'string') {
        throw createValidationError('fileName is required');
      }
      
      if (!data.fileSize || data.fileSize <= 0) {
        throw createValidationError('Invalid file size');
      }
      
      return data as UploadRequest;
    });
    
    // Process upload...
    return NextResponse.json({ success: true });
  }
);
```

### Authentication Required Routes

```typescript
// app/api/admin/users/route.ts
import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth, requirePermission } from '@/lib/errors';
import { validateToken } from '@/lib/auth';

export const GET = withErrorHandler(
  async (request: NextRequest) => {
    // Validate authentication
    const { userId } = await requireAuth(request, validateToken);
    
    // Check permissions
    const userPermissions = await getUserPermissions(userId);
    requirePermission(userPermissions, 'admin.users.read');
    
    // Fetch users...
    const users = await prisma.user.findMany();
    
    return NextResponse.json({ data: users });
  }
);
```

### Database Error Handling

```typescript
// app/api/files/route.ts
import { handleDatabaseError } from '@/lib/errors';

export const POST = withErrorHandler(
  async (request: NextRequest) => {
    try {
      const file = await prisma.file.create({
        data: { /* ... */ }
      });
      
      return NextResponse.json({ data: file });
    } catch (error) {
      handleDatabaseError(error); // This will throw with proper error code
    }
  }
);
```

### Custom Error Handling

```typescript
// app/api/storage/check/route.ts
import { ApiError, ErrorCode } from '@/lib/errors';

export const GET = withErrorHandler(
  async (request: NextRequest) => {
    const storageStatus = await checkStorage();
    
    if (!storageStatus.available) {
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        'Storage service is currently unavailable',
        { 
          service: 'S3',
          retryAfter: 60 
        }
      );
    }
    
    return NextResponse.json({ data: storageStatus });
  }
);
```

### Rate Limiting with Middleware

```typescript
// middleware.ts
import { createErrorMiddleware } from '@/lib/errors/error-middleware';

const errorMiddleware = createErrorMiddleware({
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100
  },
  logger: (error, request) => {
    console.error(`Error in ${request.method} ${request.url}:`, error);
  }
});

// Use in your middleware configuration
```

## Error Response Format

All errors follow this standardized format:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found",
    "details": {
      "userId": "123"
    },
    "timestamp": "2024-03-20T10:30:45.123Z",
    "traceId": "abc123-def456"
  },
  "status": 404
}
```

## Migration Guide

To update existing API routes:

1. Import the error utilities:
   ```typescript
   import { withErrorHandler, ApiError, ErrorCode } from '@/lib/errors';
   ```

2. Wrap your route handler with `withErrorHandler`:
   ```typescript
   export const GET = withErrorHandler(async (request) => {
     // Your existing code
   });
   ```

3. Replace error responses with error throws:
   ```typescript
   // Before:
   if (!user) {
     return NextResponse.json({ error: 'Not found' }, { status: 404 });
   }
   
   // After:
   if (!user) {
     throw createNotFoundError('User');
   }
   ```

4. Use proper error codes for different scenarios:
   ```typescript
   // Validation errors
   throw createValidationError('Invalid email format');
   
   // Authentication errors
   throw createUnauthorizedError('Invalid credentials');
   
   // Permission errors
   throw createForbiddenError('Access denied');
   
   // Conflict errors
   throw createConflictError('Email already exists');
   ```