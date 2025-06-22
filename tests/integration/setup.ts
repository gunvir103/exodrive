import { beforeAll, afterAll } from 'bun:test';
import { setupTestData, cleanupTestData } from './test-helpers';
import { cacheService } from '@/lib/redis';

// Global test setup
beforeAll(async () => {
  console.log('🚀 Setting up integration test environment...');
  
  // Clear all cache before tests
  try {
    await cacheService.flush();
    console.log('✅ Cache cleared successfully');
  } catch (error) {
    console.warn('⚠️  Failed to clear cache:', error);
  }
  
  // Set up test data in database
  try {
    await setupTestData();
    console.log('✅ Test data setup completed');
  } catch (error) {
    console.error('❌ Failed to set up test data:', error);
    throw error;
  }
});

// Global test teardown
afterAll(async () => {
  console.log('🧹 Cleaning up integration test environment...');
  
  // Clean up test data
  try {
    await cleanupTestData();
    console.log('✅ Test data cleanup completed');
  } catch (error) {
    console.warn('⚠️  Failed to clean up test data:', error);
  }
  
  // Clear cache after tests
  try {
    await cacheService.flush();
    console.log('✅ Cache cleared successfully');
  } catch (error) {
    console.warn('⚠️  Failed to clear cache:', error);
  }
});

// Export for use in test files
export { setupTestData, cleanupTestData };