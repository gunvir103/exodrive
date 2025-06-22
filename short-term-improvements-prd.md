# Product Requirements Document: ExoDrive API Redesign - Short-Term Improvements

## Document Information
- **Version**: 1.0
- **Date**: January 21, 2025
- **Author**: Engineering Team
- **Status**: Draft
- **Review Date**: February 11, 2025

---

## 1. Executive Summary

This PRD outlines the short-term improvements for the ExoDrive API redesign, building upon the foundation established in Phase 1 (Redis caching, standardized error handling, and rate limiting). The focus is on implementing architectural improvements that will significantly enhance code maintainability, type safety, and system reliability.

The key deliverables include implementing a robust Service Layer Pattern to separate business logic from API routes, integrating BullMQ for reliable background job processing, and adopting tRPC for end-to-end type safety between the frontend and backend.

### Key Deliverables
- **Service Layer Pattern**: Complete separation of business logic from HTTP handlers
- **Queue System (BullMQ)**: Asynchronous processing for email, webhooks, and heavy operations
- **Type Safety (tRPC)**: End-to-end type safety and automatic API client generation
- **Comprehensive testing suite** for all new implementations
- **Migration strategy** from current REST API to tRPC

### Expected Outcomes
- 60% reduction in code duplication
- 90% reduction in runtime type errors
- 100% reliability for critical async operations (emails, webhooks)
- 50% faster feature development velocity

---

## 2. Problem Statement

### Current Issues

#### Architectural Debt
- **Mixed Concerns**: Business logic is tightly coupled with HTTP handling in route files
- **Code Duplication**: Similar logic repeated across multiple endpoints
- **Testing Difficulty**: Hard to unit test business logic without HTTP context
- **No Service Layer**: Direct database calls from API routes

#### Reliability Issues
- **Synchronous Processing**: Email sending and webhook calls block API responses
- **No Retry Logic**: Failed operations are lost forever
- **Poor Error Recovery**: No mechanism to handle transient failures
- **Performance Impact**: Heavy operations slow down user-facing requests

#### Type Safety Gaps
- **Manual Type Definitions**: Frontend and backend types maintained separately
- **Runtime Errors**: Type mismatches only discovered in production
- **No Contract Validation**: API changes break clients silently
- **Developer Friction**: Constant context switching between API docs and code

### Impact on Business
- **Development Velocity**: 40% of development time spent on type-related bugs
- **System Reliability**: 15% of bookings fail due to email/webhook timeouts
- **Customer Experience**: Significant delays when booking due to synchronous processing
- **Maintenance Cost**: 30% of bugs are related to API contract mismatches

---

## 3. Goals and Success Metrics

### Primary Goals

1. **Implement Service Layer Pattern**
   - Separate business logic from HTTP concerns
   - Create reusable service modules
   - Improve testability and maintainability

2. **Integrate Queue System (BullMQ)**
   - Move all async operations to background jobs
   - Implement retry logic and error handling
   - Add job monitoring and alerting

3. **Adopt tRPC for Type Safety**
   - Single source of truth for API types
   - Automatic client generation
   - Compile-time validation of API calls

### Success Metrics

#### Code Quality Metrics
- **Code Coverage**: >85% for service layer
- **Type Coverage**: 100% for all API endpoints
- **Code Duplication**: <5% (measured by SonarQube)
- **Cyclomatic Complexity**: <10 for all service methods

#### Performance Metrics
- **API Response Time**: <100ms for all synchronous operations
- **Job Processing Time**: 95% of jobs completed successfully
- **Queue Throughput**: High capacity job processing
- **Error Recovery Rate**: 99% of failed jobs successfully retried

#### Developer Experience Metrics
- **Feature Development Time**: 50% reduction
- **Type-related Bugs**: 90% reduction
- **API Integration Time**: 75% reduction
- **Developer Satisfaction**: >8/10 in quarterly survey

---

## 4. Scope and Requirements

### In Scope

#### Service Layer Pattern Implementation
1. **Core Services Implementation**
   - `BookingService`: All booking-related business logic
   - `CarService`: Car management and availability
   - `PaymentService`: Payment processing logic
   - `EmailService`: Email template and sending logic
   - `AuthService`: Authentication and authorization

2. **Service Infrastructure**
   - Dependency injection container
   - Service lifecycle management
   - Transaction support
   - Error handling and logging

3. **Migration of Existing Routes**
   - Refactor all API routes to use services
   - Maintain backward compatibility
   - Add comprehensive tests

#### Queue System (BullMQ) Implementation
1. **Queue Infrastructure**
   - Redis-backed BullMQ setup
   - Queue monitoring dashboard
   - Dead letter queue handling
   - Job scheduling support

2. **Job Types Implementation**
   - Email sending jobs
   - Webhook delivery jobs
   - Image processing jobs
   - Report generation jobs
   - Booking reminders

3. **Reliability Features**
   - Exponential backoff retry
   - Circuit breaker pattern
   - Job prioritization
   - Graceful shutdown handling

#### Type Safety (tRPC) Implementation
1. **tRPC Integration**
   - tRPC server setup
   - Context and middleware
   - Error handling
   - Authentication integration

2. **API Migration**
   - Convert core endpoints to tRPC
   - Maintain REST API compatibility layer
   - Generate TypeScript client
   - Update frontend to use tRPC client

3. **Developer Tools**
   - API playground
   - Type generation scripts
   - Migration guides
   - Testing utilities

### Out of Scope
- Complete REST API deprecation (planned for later phase)
- Database schema changes
- Frontend UI overhaul
- Third-party API integrations (beyond current)
- Real-time features (WebSocket)

### Dependencies on Phase 1
- Redis infrastructure (for BullMQ)
- Error handling middleware (to be extended)
- Rate limiting (to be integrated with tRPC)
- Monitoring infrastructure

---

## 5. Technical Specifications

### 5.1 Service Layer Pattern Implementation

#### Architecture Overview
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   tRPC/REST │────▶│   Services  │────▶│ Repositories│
│   Handlers  │     │    Layer    │     │    Layer    │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │                    │
       ▼                    ▼                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Validation │     │   Business  │     │  Database   │
│  Middleware │     │    Logic    │     │   Access    │
└─────────────┘     └─────────────┘     └─────────────┘
```

#### Service Base Class
```typescript
// lib/services/base.service.ts
export abstract class BaseService {
  protected logger: Logger;
  protected cache: CacheService;
  protected db: DatabaseConnection;
  
  constructor(dependencies: ServiceDependencies) {
    this.logger = dependencies.logger;
    this.cache = dependencies.cache;
    this.db = dependencies.db;
  }
  
  protected async withTransaction<T>(
    callback: (trx: Transaction) => Promise<T>
  ): Promise<T> {
    const trx = await this.db.transaction();
    try {
      const result = await callback(trx);
      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }
  
  protected async withCache<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.cache.get<T>(key);
    if (cached) return cached;
    
    const result = await factory();
    await this.cache.set(key, result, ttl);
    return result;
  }
}
```

#### Booking Service Example
```typescript
// lib/services/booking.service.ts
export class BookingService extends BaseService {
  constructor(
    dependencies: ServiceDependencies,
    private carService: CarService,
    private paymentService: PaymentService,
    private emailService: EmailService,
    private queueService: QueueService
  ) {
    super(dependencies);
  }
  
  async createBooking(input: CreateBookingInput): Promise<Booking> {
    return this.withTransaction(async (trx) => {
      // Validate availability
      const availability = await this.carService.checkAvailability(
        input.carId,
        input.startDate,
        input.endDate,
        trx
      );
      
      if (!availability.isAvailable) {
        throw new BookingError('Car not available for selected dates');
      }
      
      // Create booking record
      const booking = await this.createBookingRecord(input, trx);
      
      // Process payment
      const payment = await this.paymentService.processPayment({
        bookingId: booking.id,
        amount: booking.totalAmount,
        paymentMethod: input.paymentMethod
      }, trx);
      
      // Update booking with payment info
      await this.updateBookingPayment(booking.id, payment.id, trx);
      
      // Queue async operations
      await this.queueService.add('sendBookingConfirmation', {
        bookingId: booking.id,
        email: input.customerEmail
      });
      
      await this.queueService.add('syncWithDocuSign', {
        bookingId: booking.id
      });
      
      // Invalidate relevant caches
      await this.invalidateBookingCaches(input.carId);
      
      return booking;
    });
  }
  
  async getBookingsByUser(userId: string, options?: PaginationOptions): Promise<PaginatedResult<Booking>> {
    return this.withCache(
      `bookings:user:${userId}:${JSON.stringify(options)}`,
      async () => {
        const bookings = await this.db.bookings.findMany({
          where: { userId },
          ...options
        });
        
        return {
          data: bookings,
          total: await this.db.bookings.count({ where: { userId } }),
          page: options?.page || 1,
          pageSize: options?.pageSize || 10
        };
      },
      300 // Short TTL
    );
  }
  
  private async createBookingRecord(input: CreateBookingInput, trx: Transaction): Promise<Booking> {
    // Implementation
  }
  
  private async updateBookingPayment(bookingId: string, paymentId: string, trx: Transaction): Promise<void> {
    // Implementation
  }
  
  private async invalidateBookingCaches(carId: string): Promise<void> {
    await Promise.all([
      this.cache.invalidate(`availability:${carId}:*`),
      this.cache.invalidate(`bookings:car:${carId}:*`)
    ]);
  }
}
```

#### Dependency Injection Setup
```typescript
// lib/services/container.ts
import { Container } from 'inversify';

export const container = new Container();

// Register services
container.bind<BookingService>(BookingService).toSelf().inSingletonScope();
container.bind<CarService>(CarService).toSelf().inSingletonScope();
container.bind<PaymentService>(PaymentService).toSelf().inSingletonScope();
container.bind<EmailService>(EmailService).toSelf().inSingletonScope();
container.bind<QueueService>(QueueService).toSelf().inSingletonScope();

// Register dependencies
container.bind<Logger>('Logger').toConstantValue(logger);
container.bind<CacheService>('CacheService').toConstantValue(cacheService);
container.bind<DatabaseConnection>('Database').toConstantValue(db);

// Helper to get services
export function getService<T>(serviceClass: new (...args: any[]) => T): T {
  return container.get<T>(serviceClass);
}
```

### 5.2 Queue System (BullMQ) Implementation

#### Queue Configuration
```typescript
// lib/queue/config.ts
export const queueConfig = {
  connection: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    removeOnComplete: {
      age: 86400, // Cleanup after completion
      count: 100
    },
    removeOnFail: {
      age: 604800 // Extended retention for failed jobs
    },
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
};

export const queues = {
  email: 'email-queue',
  webhook: 'webhook-queue',
  imageProcessing: 'image-processing-queue',
  reports: 'reports-queue',
  notifications: 'notifications-queue'
} as const;
```

#### Queue Service Implementation
```typescript
// lib/queue/queue.service.ts
import { Queue, Worker, QueueEvents, Job } from 'bullmq';

export class QueueService {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private events: Map<string, QueueEvents> = new Map();
  
  constructor(private config: QueueConfig) {
    this.initializeQueues();
  }
  
  private initializeQueues() {
    Object.entries(queues).forEach(([key, queueName]) => {
      const queue = new Queue(queueName, {
        connection: this.config.connection,
        defaultJobOptions: this.config.defaultJobOptions
      });
      
      const events = new QueueEvents(queueName, {
        connection: this.config.connection
      });
      
      this.queues.set(queueName, queue);
      this.events.set(queueName, events);
      
      // Set up event listeners
      events.on('completed', ({ jobId }) => {
        this.logger.info(`Job ${jobId} completed in ${queueName}`);
      });
      
      events.on('failed', ({ jobId, failedReason }) => {
        this.logger.error(`Job ${jobId} failed in ${queueName}: ${failedReason}`);
      });
    });
  }
  
  async add<T = any>(
    queueName: string,
    jobName: string,
    data: T,
    options?: JobOptions
  ): Promise<Job<T>> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    
    return queue.add(jobName, data, {
      ...this.config.defaultJobOptions,
      ...options
    });
  }
  
  async addBulk<T = any>(
    queueName: string,
    jobs: Array<{ name: string; data: T; opts?: JobOptions }>
  ): Promise<Job<T>[]> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    
    return queue.addBulk(jobs);
  }
  
  registerWorker<T = any>(
    queueName: string,
    processor: (job: Job<T>) => Promise<any>,
    options?: WorkerOptions
  ): Worker<T> {
    const worker = new Worker<T>(
      queueName,
      processor,
      {
        connection: this.config.connection,
        ...options
      }
    );
    
    this.workers.set(queueName, worker);
    return worker;
  }
  
  async getJobCounts(queueName: string): Promise<JobCounts> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    
    return queue.getJobCounts();
  }
  
  async pause(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    
    await queue.pause();
  }
  
  async resume(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    
    await queue.resume();
  }
  
  async close(): Promise<void> {
    await Promise.all([
      ...Array.from(this.queues.values()).map(q => q.close()),
      ...Array.from(this.workers.values()).map(w => w.close()),
      ...Array.from(this.events.values()).map(e => e.close())
    ]);
  }
}
```

#### Email Queue Worker
```typescript
// lib/queue/workers/email.worker.ts
import { Job } from 'bullmq';
import { EmailService } from '../../services/email.service';

export interface EmailJobData {
  type: 'bookingConfirmation' | 'bookingReminder' | 'paymentReceipt';
  to: string;
  data: any;
}

export class EmailWorker {
  constructor(
    private emailService: EmailService,
    private queueService: QueueService
  ) {
    this.initialize();
  }
  
  private initialize() {
    this.queueService.registerWorker<EmailJobData>(
      queues.email,
      this.processEmailJob.bind(this),
      {
        concurrency: 10,
        limiter: {
          max: 100,
          duration: 60000 // Email rate limit
        }
      }
    );
  }
  
  private async processEmailJob(job: Job<EmailJobData>): Promise<void> {
    const { type, to, data } = job.data;
    
    try {
      switch (type) {
        case 'bookingConfirmation':
          await this.emailService.sendBookingConfirmation(to, data);
          break;
        case 'bookingReminder':
          await this.emailService.sendBookingReminder(to, data);
          break;
        case 'paymentReceipt':
          await this.emailService.sendPaymentReceipt(to, data);
          break;
        default:
          throw new Error(`Unknown email type: ${type}`);
      }
      
      // Update job progress
      await job.updateProgress(100);
      
    } catch (error) {
      // Log error with context
      this.logger.error('Email job failed', {
        jobId: job.id,
        type,
        to,
        error: error.message,
        attempt: job.attemptsMade
      });
      
      // If this is the last attempt, send to dead letter queue
      if (job.attemptsMade >= job.opts.attempts!) {
        await this.queueService.add(
          'dead-letter-queue',
          'failed-email',
          {
            originalJob: job.data,
            error: error.message,
            failedAt: new Date()
          }
        );
      }
      
      throw error; // Re-throw to trigger retry
    }
  }
}
```

#### Webhook Queue Worker
```typescript
// lib/queue/workers/webhook.worker.ts
import { Job } from 'bullmq';
import axios from 'axios';

export interface WebhookJobData {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  data?: any;
  retryConfig?: {
    maxRetries?: number;
    retryDelay?: number;
  };
}

export class WebhookWorker {
  constructor(private queueService: QueueService) {
    this.initialize();
  }
  
  private initialize() {
    this.queueService.registerWorker<WebhookJobData>(
      queues.webhook,
      this.processWebhookJob.bind(this),
      {
        concurrency: 20,
        limiter: {
          max: 200,
          duration: 60000 // Webhook rate limit
        }
      }
    );
  }
  
  private async processWebhookJob(job: Job<WebhookJobData>): Promise<void> {
    const { url, method, headers, data } = job.data;
    
    try {
      const response = await axios({
        url,
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Id': job.id!,
          'X-Webhook-Attempt': String(job.attemptsMade + 1),
          ...headers
        },
        data,
        timeout: 30000, // Request timeout
        validateStatus: (status) => status < 500 // Don't retry on 4xx errors
      });
      
      if (response.status >= 400) {
        throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
      }
      
      // Log successful delivery
      this.logger.info('Webhook delivered successfully', {
        jobId: job.id,
        url,
        status: response.status
      });
      
    } catch (error) {
      // Check if error is retryable
      if (axios.isAxiosError(error) && error.response?.status >= 400 && error.response?.status < 500) {
        // Don't retry client errors
        this.logger.error('Webhook failed with client error', {
          jobId: job.id,
          url,
          status: error.response.status,
          error: error.message
        });
        return; // Mark as completed (don't retry)
      }
      
      // Server error or network error - retry
      throw error;
    }
  }
}
```

### 5.3 Type Safety (tRPC) Implementation

#### tRPC Server Setup
```typescript
// lib/trpc/context.ts
import { CreateNextContextOptions } from '@trpc/server/adapters/next';
import { getServerSession } from 'next-auth';

export async function createContext(opts: CreateNextContextOptions) {
  const { req, res } = opts;
  const session = await getServerSession(req, res, authOptions);
  
  return {
    req,
    res,
    session,
    services: {
      booking: getService(BookingService),
      car: getService(CarService),
      payment: getService(PaymentService),
      email: getService(EmailService)
    }
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
```

#### tRPC Router Setup
```typescript
// lib/trpc/routers/base.ts
import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from '../context';
import superjson from 'superjson';
import { ZodError } from 'zod';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError
            ? error.cause.flatten()
            : null,
      },
    };
  },
});

// Middleware
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.session.user,
    },
  });
});

const isAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user || ctx.session.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.session.user,
    },
  });
});

// Rate limiting middleware
const rateLimited = (limit: number, window: number) => {
  return t.middleware(async ({ ctx, next, path }) => {
    const key = `rate-limit:${path}:${ctx.session?.user?.id || ctx.req.ip}`;
    const result = await rateLimiter.checkLimit(key, { max: limit, windowMs: window });
    
    if (!result.allowed) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded',
      });
    }
    
    return next();
  });
};

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthed);
export const adminProcedure = t.procedure.use(isAdmin);
export const limitedProcedure = (limit: number, window: number) => 
  t.procedure.use(rateLimited(limit, window));
```

#### Booking Router Implementation
```typescript
// lib/trpc/routers/booking.router.ts
import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from './base';

// Input schemas
const createBookingSchema = z.object({
  carId: z.string().uuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  customerInfo: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(10),
  }),
  extras: z.array(z.string()).optional(),
  paymentMethod: z.enum(['card', 'paypal']),
});

const getBookingsSchema = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(10),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
  sortBy: z.enum(['createdAt', 'startDate', 'totalAmount']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const bookingRouter = router({
  // Create a new booking
  create: protectedProcedure
    .input(createBookingSchema)
    .mutation(async ({ ctx, input }) => {
      const booking = await ctx.services.booking.createBooking({
        ...input,
        userId: ctx.user.id,
      });
      
      return booking;
    }),
  
  // Get user's bookings
  list: protectedProcedure
    .input(getBookingsSchema)
    .query(async ({ ctx, input }) => {
      const bookings = await ctx.services.booking.getBookingsByUser(
        ctx.user.id,
        input
      );
      
      return bookings;
    }),
  
  // Get single booking
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const booking = await ctx.services.booking.getBooking(input.id);
      
      // Check ownership
      if (booking.userId !== ctx.user.id && ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this booking',
        });
      }
      
      return booking;
    }),
  
  // Cancel booking
  cancel: protectedProcedure
    .input(z.object({ 
      id: z.string().uuid(),
      reason: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const booking = await ctx.services.booking.cancelBooking(
        input.id,
        ctx.user.id,
        input.reason
      );
      
      return booking;
    }),
  
  // Check availability (public)
  checkAvailability: publicProcedure
    .input(z.object({
      carId: z.string().uuid(),
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
    }))
    .query(async ({ ctx, input }) => {
      const availability = await ctx.services.car.checkAvailability(
        input.carId,
        input.startDate,
        input.endDate
      );
      
      return availability;
    }),
});
```

#### Car Router Implementation
```typescript
// lib/trpc/routers/car.router.ts
import { z } from 'zod';
import { router, publicProcedure, adminProcedure } from './base';

const carFilterSchema = z.object({
  category: z.enum(['economy', 'luxury', 'suv', 'sports']).optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  features: z.array(z.string()).optional(),
  availableFrom: z.string().datetime().optional(),
  availableTo: z.string().datetime().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(50).default(20),
});

export const carRouter = router({
  // List cars with filters
  list: publicProcedure
    .input(carFilterSchema)
    .query(async ({ ctx, input }) => {
      const cars = await ctx.services.car.listCars(input);
      return cars;
    }),
  
  // Get single car
  get: publicProcedure
    .input(z.object({ 
      id: z.string().uuid().optional(),
      slug: z.string().optional()
    }).refine(data => data.id || data.slug, {
      message: 'Either id or slug must be provided'
    }))
    .query(async ({ ctx, input }) => {
      const car = input.id 
        ? await ctx.services.car.getCarById(input.id)
        : await ctx.services.car.getCarBySlug(input.slug!);
      
      if (!car) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Car not found',
        });
      }
      
      return car;
    }),
  
  // Create car (admin only)
  create: adminProcedure
    .input(carSchema)
    .mutation(async ({ ctx, input }) => {
      const car = await ctx.services.car.createCar(input);
      return car;
    }),
  
  // Update car (admin only)
  update: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: carSchema.partial()
    }))
    .mutation(async ({ ctx, input }) => {
      const car = await ctx.services.car.updateCar(input.id, input.data);
      return car;
    }),
  
  // Delete car (admin only)
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.services.car.deleteCar(input.id);
      return { success: true };
    }),
});
```

#### Main App Router
```typescript
// lib/trpc/routers/app.router.ts
import { router } from './base';
import { bookingRouter } from './booking.router';
import { carRouter } from './car.router';
import { paymentRouter } from './payment.router';
import { userRouter } from './user.router';
import { adminRouter } from './admin.router';

export const appRouter = router({
  booking: bookingRouter,
  car: carRouter,
  payment: paymentRouter,
  user: userRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
```

#### tRPC Client Setup
```typescript
// lib/trpc/client.ts
import { createTRPCNext } from '@trpc/next';
import { httpBatchLink, loggerLink } from '@trpc/client';
import { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from './routers/app.router';
import superjson from 'superjson';

function getBaseUrl() {
  if (typeof window !== 'undefined') return '';
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export const trpc = createTRPCNext<AppRouter>({
  config() {
    return {
      transformer: superjson,
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === 'development' ||
            (opts.direction === 'down' && opts.result instanceof Error),
        }),
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          headers() {
            return {
              // Add any custom headers here
            };
          },
        }),
      ],
    };
  },
  ssr: false,
});

// Type helpers
export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;
```

#### Frontend Usage Example
```typescript
// app/booking/create/page.tsx
import { trpc } from '@/lib/trpc/client';

export default function CreateBooking() {
  const { data: cars } = trpc.car.list.useQuery({
    category: 'luxury',
    page: 1,
    pageSize: 10,
  });
  
  const createBooking = trpc.booking.create.useMutation({
    onSuccess: (booking) => {
      router.push(`/booking/${booking.id}/confirmation`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  const checkAvailability = trpc.booking.checkAvailability.useQuery(
    {
      carId: selectedCar?.id,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
    {
      enabled: !!selectedCar && !!startDate && !!endDate,
    }
  );
  
  const handleSubmit = async (data: BookingFormData) => {
    await createBooking.mutateAsync({
      carId: selectedCar.id,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      customerInfo: data.customerInfo,
      extras: data.extras,
      paymentMethod: data.paymentMethod,
    });
  };
  
  // Component render...
}
```

---

## 6. User Stories

### As a Developer
1. **Service Layer Usage**: As a developer, I want to use service classes for business logic so that I can write cleaner, more testable code.
   - **Acceptance Criteria**:
     - All business logic is in service classes
     - Services are easily mockable for testing
     - Clear separation between HTTP and business concerns
     - Comprehensive service documentation

2. **Type-Safe API Calls**: As a frontend developer, I want type-safe API calls so that I catch errors at compile time.
   - **Acceptance Criteria**:
     - Auto-completion for all API endpoints
     - Compile-time validation of API parameters
     - Automatic type inference for responses
     - No manual type definitions needed

3. **Reliable Background Jobs**: As a developer, I want reliable background job processing so that async operations don't fail silently.
   - **Acceptance Criteria**:
     - All async operations use job queues
     - Failed jobs are automatically retried
     - Job status is trackable
     - Dead letter queue for permanently failed jobs

### As a System Administrator
1. **Queue Monitoring**: As an admin, I want to monitor job queues so that I can ensure system health.
   - **Acceptance Criteria**:
     - Real-time queue metrics dashboard
     - Alerts for queue backlogs
     - Job failure notifications
     - Performance metrics per job type

2. **Service Health Monitoring**: As an admin, I want to monitor service health so that I can prevent issues.
   - **Acceptance Criteria**:
     - Service dependency health checks
     - Performance metrics per service
     - Error rate tracking
     - Resource usage monitoring

### As a Customer
1. **Faster Booking Process**: As a customer, I want fast booking confirmation so that I can complete my reservation quickly.
   - **Acceptance Criteria**:
     - Fast booking confirmation
     - Quick email delivery
     - No timeout errors during booking
     - Clear progress indicators

2. **Reliable Email Delivery**: As a customer, I want to receive all booking emails so that I have proper documentation.
   - **Acceptance Criteria**:
     - 99.9% email delivery rate
     - Reliable email delivery
     - Retry on temporary failures
     - Alternative notification methods available

---

## 7. Implementation Strategy

### Service Layer Pattern Implementation

#### Core Infrastructure
- Set up dependency injection container
- Create BaseService class and utilities
- Implement transaction management
- Create service testing utilities

#### Service Implementation
- Implement BookingService
- Implement CarService
- Implement PaymentService
- Implement EmailService and AuthService

#### Migration Strategy
- Migrate booking routes to use services
- Migrate car routes to use services
- Migrate remaining routes
- Update tests for service layer
- Integration testing and documentation

### Queue System Implementation

#### Queue Infrastructure
- Set up BullMQ with Redis
- Create QueueService class
- Implement job monitoring dashboard
- Set up dead letter queue handling

#### Worker Implementation
- Implement email worker
- Implement webhook worker
- Implement image processing worker
- Implement report generation worker

#### Integration
- Integrate queues with BookingService
- Integrate queues with other services
- Implement retry logic and circuit breakers
- Performance testing and optimization
- Load testing and scaling verification

### Type Safety with tRPC Implementation

#### tRPC Setup
- Set up tRPC server infrastructure
- Create context and middleware
- Implement authentication middleware
- Set up error handling and logging

#### Router Implementation
- Create booking router
- Create car and payment routers
- Create admin routers
- Create remaining routers

#### Frontend Integration
- Set up tRPC client
- Migrate booking flow to tRPC
- Migrate remaining frontend calls
- Update error handling in frontend
- End-to-end testing and deployment

---

## 8. Dependencies on Phase 1 Deliverables

### Redis Infrastructure
- **Required for**: BullMQ queue system
- **Dependency**: Redis must be properly configured and tested
- **Mitigation**: If Redis setup is delayed, use in-memory queue for development

### Error Handling Middleware
- **Required for**: Consistent error responses in tRPC
- **Dependency**: Standardized error format must be established
- **Mitigation**: Extend existing error handling to support tRPC errors

### Rate Limiting
- **Required for**: tRPC rate limiting middleware
- **Dependency**: Rate limiter must be modular and reusable
- **Mitigation**: Implement basic rate limiting if advanced features delayed

### Monitoring Infrastructure
- **Required for**: Queue and service monitoring
- **Dependency**: Logging and metrics collection must be operational
- **Mitigation**: Use basic logging until full monitoring is ready

---

## 9. Risk Assessment

### Technical Risks

#### Risk: Service Layer Complexity
- **Probability**: Medium
- **Impact**: High
- **Mitigation**:
  - Start with simple services and evolve
  - Maintain clear service boundaries
  - Comprehensive documentation
  - Regular code reviews

#### Risk: Queue System Failures
- **Probability**: Low
- **Impact**: High
- **Mitigation**:
  - Implement circuit breakers
  - Dead letter queue for failed jobs
  - Manual retry mechanisms
  - Queue monitoring and alerts

#### Risk: tRPC Migration Breaking Changes
- **Probability**: Medium
- **Impact**: Medium
- **Mitigation**:
  - Maintain REST API compatibility layer
  - Gradual migration approach
  - Comprehensive testing
  - Feature flags for rollback

### Business Risks

#### Risk: Development Timeline Overrun
- **Probability**: Medium
- **Impact**: Medium
- **Mitigation**:
  - Clear priorities for MVP features
  - Daily progress tracking
  - Early identification of blockers
  - Resource reallocation as needed

#### Risk: Performance Degradation
- **Probability**: Low
- **Impact**: High
- **Mitigation**:
  - Continuous performance monitoring
  - Load testing before deployment
  - Gradual rollout strategy
  - Quick rollback procedures

---

## 10. Testing Strategy

### Unit Testing

#### Service Layer Tests
```typescript
describe('BookingService', () => {
  let bookingService: BookingService;
  let mockCarService: jest.Mocked<CarService>;
  let mockPaymentService: jest.Mocked<PaymentService>;
  
  beforeEach(() => {
    mockCarService = createMockService(CarService);
    mockPaymentService = createMockService(PaymentService);
    
    bookingService = new BookingService({
      carService: mockCarService,
      paymentService: mockPaymentService,
      // ... other mocks
    });
  });
  
  describe('createBooking', () => {
    it('should create booking when car is available', async () => {
      // Arrange
      mockCarService.checkAvailability.mockResolvedValue({
        isAvailable: true,
        conflicts: []
      });
      
      mockPaymentService.processPayment.mockResolvedValue({
        id: 'payment-123',
        status: 'completed'
      });
      
      // Act
      const booking = await bookingService.createBooking({
        carId: 'car-123',
        startDate: '2025-02-01',
        endDate: '2025-02-05',
        // ... other data
      });
      
      // Assert
      expect(booking).toBeDefined();
      expect(booking.status).toBe('confirmed');
      expect(mockCarService.checkAvailability).toHaveBeenCalledWith(
        'car-123',
        '2025-02-01',
        '2025-02-05'
      );
    });
    
    it('should throw error when car is not available', async () => {
      // Test implementation
    });
  });
});
```

#### Queue Worker Tests
```typescript
describe('EmailWorker', () => {
  let emailWorker: EmailWorker;
  let mockEmailService: jest.Mocked<EmailService>;
  let job: Job<EmailJobData>;
  
  beforeEach(() => {
    mockEmailService = createMockService(EmailService);
    emailWorker = new EmailWorker(mockEmailService);
    
    job = {
      id: 'job-123',
      data: {
        type: 'bookingConfirmation',
        to: 'customer@example.com',
        data: { bookingId: 'booking-123' }
      },
      attemptsMade: 0,
      opts: { attempts: 3 },
      updateProgress: jest.fn()
    } as any;
  });
  
  it('should process booking confirmation email', async () => {
    // Test implementation
  });
  
  it('should retry on transient failures', async () => {
    // Test implementation
  });
});
```

### Integration Testing

#### tRPC Integration Tests
```typescript
describe('Booking API Integration', () => {
  let caller: ReturnType<typeof appRouter.createCaller>;
  
  beforeEach(() => {
    caller = appRouter.createCaller({
      session: { user: { id: 'user-123', role: 'customer' } },
      services: {
        booking: realBookingService,
        car: realCarService,
        // ... other services
      }
    });
  });
  
  it('should create booking through tRPC', async () => {
    const booking = await caller.booking.create({
      carId: 'car-123',
      startDate: '2025-02-01T10:00:00Z',
      endDate: '2025-02-05T10:00:00Z',
      customerInfo: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+1234567890'
      },
      paymentMethod: 'card'
    });
    
    expect(booking.id).toBeDefined();
    expect(booking.status).toBe('confirmed');
  });
});
```

### Load Testing

#### Queue Load Testing
```javascript
// load-test/queue-load-test.js
import { check } from 'k6';
import http from 'k6/http';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],    // Error rate under 10%
  },
};

export default function () {
  const payload = JSON.stringify({
    carId: 'car-123',
    startDate: '2025-02-01T10:00:00Z',
    endDate: '2025-02-05T10:00:00Z',
    // ... other booking data
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${__ENV.AUTH_TOKEN}',
    },
  };
  
  const res = http.post('http://localhost:3000/api/trpc/booking.create', payload, params);
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'booking created': (r) => JSON.parse(r.body).result.data.id !== undefined,
    'response time OK': (r) => r.timings.duration < 500,
  });
}
```

---

## 11. Migration Plan

### Phase 1: Service Layer Migration (Week 2)

#### Step 1: Parallel Implementation
- Implement services alongside existing code
- No breaking changes to API routes
- Services call existing functions initially

#### Step 2: Gradual Migration
```typescript
// Before: Direct logic in route
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const carId = searchParams.get('carId');
  
  // Direct database call
  const car = await prisma.car.findUnique({ where: { id: carId } });
  // ... booking logic
}

// After: Using service
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const carId = searchParams.get('carId');
  
  const carService = getService(CarService);
  const car = await carService.getCarById(carId);
  // ... simplified route logic
}
```

#### Step 3: Testing & Validation
- Run parallel tests
- Compare outputs
- Monitor performance
- Fix discrepancies

### Phase 2: Queue System Integration (Week 3)

#### Step 1: Shadow Mode
- Queue jobs without processing
- Monitor queue performance
- Validate job data

#### Step 2: Gradual Processing
```typescript
// Feature flag controlled
if (features.enableAsyncEmail) {
  await queueService.add('email', 'bookingConfirmation', emailData);
} else {
  await emailService.sendBookingConfirmation(emailData);
}
```

#### Step 3: Full Migration
- Enable all workers
- Remove synchronous code
- Monitor error rates

### Phase 3: tRPC Migration (Week 4)

#### Step 1: Dual API Support
```typescript
// Next.js API Route wrapper for tRPC compatibility
export async function POST(req: Request) {
  // Parse REST request
  const body = await req.json();
  
  // Call tRPC procedure
  const caller = appRouter.createCaller({ /* context */ });
  const result = await caller.booking.create(body);
  
  // Return REST response
  return NextResponse.json(result);
}
```

#### Step 2: Client Migration
- Update one feature at a time
- Maintain backward compatibility
- Test thoroughly

#### Step 3: Deprecation
- Mark REST endpoints as deprecated
- Provide migration timeline
- Support transition period

---

## 12. Documentation Requirements

### API Documentation

#### Service Layer Documentation
```typescript
/**
 * BookingService handles all booking-related business logic
 * 
 * @example
 * ```typescript
 * const bookingService = getService(BookingService);
 * const booking = await bookingService.createBooking({
 *   carId: 'car-123',
 *   startDate: new Date('2025-02-01'),
 *   endDate: new Date('2025-02-05'),
 *   userId: 'user-123'
 * });
 * ```
 */
export class BookingService {
  /**
   * Creates a new booking with payment processing
   * 
   * @param input - Booking creation parameters
   * @returns Created booking with payment details
   * @throws {BookingError} When car is not available
   * @throws {PaymentError} When payment fails
   */
  async createBooking(input: CreateBookingInput): Promise<Booking> {
    // Implementation
  }
}
```

#### tRPC API Documentation
- Auto-generated from tRPC schemas
- Interactive API playground
- Type definitions exported
- Migration guides from REST

### Developer Guides

#### Service Layer Guide
1. Creating new services
2. Dependency injection
3. Transaction handling
4. Testing services
5. Best practices

#### Queue System Guide
1. Creating job types
2. Worker implementation
3. Error handling
4. Monitoring queues
5. Scaling considerations

#### tRPC Migration Guide
1. Converting REST to tRPC
2. Client setup
3. Error handling
4. Authentication
5. Testing strategies

### Operations Documentation

#### Monitoring Guide
- Queue metrics to track
- Service health checks
- Alert configurations
- Troubleshooting steps

#### Deployment Guide
- Environment variables
- Infrastructure requirements
- Rollback procedures
- Performance tuning

---

## Appendices

### A. Technology Stack

#### New Dependencies
```json
{
  "dependencies": {
    "@trpc/server": "^10.45.0",
    "@trpc/client": "^10.45.0",
    "@trpc/react-query": "^10.45.0",
    "@trpc/next": "^10.45.0",
    "bullmq": "^5.1.0",
    "ioredis": "^5.3.0",
    "inversify": "^6.0.0",
    "reflect-metadata": "^0.2.0",
    "superjson": "^2.2.0"
  },
  "devDependencies": {
    "@types/inversify": "^2.0.0",
    "bull-board": "^2.1.0"
  }
}
```

### B. Configuration Examples

#### Service Configuration
```typescript
// config/services.config.ts
export const servicesConfig = {
  booking: {
    maxConcurrentBookings: 10,
    reservationTimeout: 900000, // Booking reservation timeout
    cancellationWindow: 86400000, // Cancellation window duration
  },
  email: {
    provider: 'resend',
    from: 'noreply@exodrive.com',
    replyTo: 'support@exodrive.com',
  },
  queue: {
    concurrency: {
      email: 10,
      webhook: 20,
      imageProcessing: 5,
    },
    retryDelays: {
      email: [1000, 5000, 30000], // Progressive retry delays
      webhook: [2000, 10000, 60000], // Progressive retry delays
    },
  },
};
```

### C. Monitoring Dashboards

#### Queue Dashboard Components
1. Queue sizes and throughput
2. Job success/failure rates
3. Average processing time
4. Worker utilization
5. Dead letter queue size

#### Service Metrics Dashboard
1. Request rate per service
2. Error rate per service
3. Response time percentiles
4. Database query performance
5. Cache hit rates

### D. Migration Checklist

#### Pre-Migration
- [ ] All Week 1 deliverables completed
- [ ] Test environment ready
- [ ] Monitoring infrastructure operational
- [ ] Team training completed
- [ ] Rollback plan documented

#### During Migration
- [ ] Feature flags configured
- [ ] Shadow mode testing passed
- [ ] Performance benchmarks met
- [ ] Error rates within threshold
- [ ] Documentation updated

#### Post-Migration
- [ ] Old code deprecated
- [ ] Metrics validated
- [ ] Team feedback collected
- [ ] Lessons learned documented
- [ ] Next phase planning started

---

## Sign-off

- **Product Manager**: ___________________ Date: ___________
- **Engineering Lead**: ___________________ Date: ___________
- **DevOps Lead**: ___________________ Date: ___________
- **QA Lead**: ___________________ Date: ___________

---

*This document is a living document and will be updated as implementation progresses and new requirements emerge.*