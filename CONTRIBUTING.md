# Contributing to ExoDrive

Thank you for your interest in contributing to ExoDrive! This guide will help you get started.

## Code of Conduct

Be respectful, inclusive, and professional. We're building something great together.

## Getting Started

### Prerequisites
- Node.js 18+ (we use Bun runtime)
- PostgreSQL (via Supabase)
- Redis (Upstash for local dev)
- Git

### Development Setup
1. Fork and clone the repository
   ```bash
   git clone https://github.com/yourusername/exodrive.git
   cd exodrive
   ```

2. Install dependencies
   ```bash
   bun install
   ```

3. Set up environment variables
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your values
   ```

4. Run database migrations
   ```bash
   bun run db:migrate
   ```

5. Start development server
   ```bash
   bun dev
   ```

## Development Guidelines

### Code Standards

#### TypeScript
- Use strict mode
- No `any` types (use `unknown` if needed)
- Define interfaces for all data structures
- Use Zod for runtime validation

#### Code Style
```typescript
// Good
export async function getCarDetails(carId: string): Promise<Car> {
  const { data, error } = await supabase
    .from('cars')
    .select('*')
    .eq('id', carId)
    .single();
    
  if (error) throw new ApiError('Car not found', 'CAR_NOT_FOUND');
  return data;
}

// Bad
export async function getCarDetails(id: any) {
  const car = await supabase.from('cars').select('*').eq('id', id).single();
  return car.data;
}
```

#### Error Handling
- Use `ApiError` class for API errors
- Log errors with context
- Return user-friendly messages
- Never expose internal details

### Testing Requirements

#### Test Coverage
- Minimum 80% coverage for new code
- Unit tests for all utilities
- Integration tests for API endpoints
- E2E tests for critical flows

#### Running Tests
```bash
# All tests
bun test

# Specific suite
bun test:unit
bun test:integration

# With coverage
bun test:coverage

# Watch mode
bun test --watch
```

#### Writing Tests
```typescript
import { describe, it, expect, beforeEach } from 'bun:test';

describe('CarService', () => {
  beforeEach(() => {
    // Setup
  });

  it('should return car details', async () => {
    // Arrange
    const carId = 'test-id';
    
    // Act
    const car = await carService.getCarDetails(carId);
    
    // Assert
    expect(car).toBeDefined();
    expect(car.id).toBe(carId);
  });
});
```

### API Development

#### Endpoint Structure
```typescript
// app/api/resource/route.ts
import { withApiErrorHandling } from '@/lib/api-error-handler';

async function GET(request: Request) {
  // Validate input
  const { searchParams } = new URL(request.url);
  const validated = querySchema.parse(Object.fromEntries(searchParams));
  
  // Check cache
  const cached = await cacheService.get(cacheKey);
  if (cached) return NextResponse.json(cached);
  
  // Business logic
  const data = await service.getData(validated);
  
  // Cache result
  await cacheService.set(cacheKey, data, ttl);
  
  // Return response
  return NextResponse.json(data);
}

export const GET = withApiErrorHandling(GET);
```

#### Security Checklist
- [ ] Input validation with Zod
- [ ] Authentication/authorization checks
- [ ] Rate limiting applied
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] Error messages sanitized

### Database Changes

#### Migrations
```bash
# Create new migration
bun run db:migration:create add_new_feature

# Apply migrations
bun run db:migrate

# Rollback
bun run db:rollback
```

#### Schema Changes
1. Always use migrations
2. Consider backwards compatibility
3. Test rollback procedures
4. Update TypeScript types

### Performance Considerations

#### Before Submitting
- [ ] Added appropriate indexes
- [ ] Implemented caching where beneficial
- [ ] Avoided N+1 queries
- [ ] Used pagination for lists
- [ ] Tested under load

## Pull Request Process

### Before Creating PR

1. **Update from main**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run all checks**
   ```bash
   bun test
   bun run lint
   bun run typecheck
   ```

3. **Update documentation**
   - Add JSDoc comments
   - Update README if needed
   - Document API changes

### PR Guidelines

#### Title Format
```
feat: Add car availability calendar
fix: Resolve booking race condition
perf: Optimize car listing query
docs: Update API documentation
```

#### Description Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Performance improvement
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings
```

### Review Process

1. Automated checks must pass
2. At least one approval required
3. Resolve all comments
4. Squash commits before merge

## Architecture Decisions

### Service Layer Pattern
- Keep controllers thin
- Business logic in services
- Reusable across endpoints

### Caching Strategy
- Cache expensive operations
- Invalidate on updates
- Graceful degradation

### Error Handling
- Consistent error format
- Proper status codes
- Helpful error messages

## Getting Help

- **Discord**: [Join our community](https://discord.gg/exodrive)
- **Issues**: Check existing issues first
- **Discussions**: For questions and ideas

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Invited to contributor meetings

Thank you for contributing to ExoDrive! 🚗