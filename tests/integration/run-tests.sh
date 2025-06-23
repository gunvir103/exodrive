#!/bin/bash

# Integration Test Runner for ExoDrive Caching

echo "🚀 Running ExoDrive Cache Integration Tests"
echo "=========================================="

# Set test environment variables
export NODE_ENV=test
export TEST_BASE_URL=${TEST_BASE_URL:-"http://localhost:3005"}

# Check if the server is running
echo "🔍 Checking if server is accessible at $TEST_BASE_URL..."
if ! curl -s -o /dev/null -w "%{http_code}" "$TEST_BASE_URL" | grep -q "200\|404"; then
    echo "❌ Server is not running at $TEST_BASE_URL"
    echo "Please start the development server with: bun run dev"
    exit 1
fi
echo "✅ Server is accessible"

# Check Redis connection
echo "🔍 Checking Redis connection..."
if [ -z "$UPSTASH_REDIS_REST_URL" ] || [ -z "$UPSTASH_REDIS_REST_TOKEN" ]; then
    echo "⚠️  Redis environment variables not set. Tests may fail."
    echo "Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN"
fi

# Run the tests
echo ""
echo "🧪 Running integration tests..."
echo ""

# Run with setup file first
bun test --preload ./tests/integration/setup.ts tests/integration/caching.test.ts tests/integration/cache-invalidation.test.ts

# Check test exit code
TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ All integration tests passed!"
else
    echo ""
    echo "❌ Some tests failed. Exit code: $TEST_EXIT_CODE"
fi

exit $TEST_EXIT_CODE