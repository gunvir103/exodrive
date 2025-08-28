import { createClient } from '@supabase/supabase-js';
// Mock the Database type for testing
type Database = {
  public: {
    Tables: {
      [key: string]: {
        Row: any;
        Insert: any;
        Update: any;
      };
    };
  };
};

// Test environment configuration
export const TEST_CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3005',
  supabaseUrl: process.env.TEST_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.TEST_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
  redisUrl: process.env.TEST_REDIS_URL || process.env.UPSTASH_REDIS_REST_URL!,
  redisToken: process.env.TEST_REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN!,
};

// Create a Supabase client for test data setup/cleanup
export const testSupabase = createClient<Database>(
  TEST_CONFIG.supabaseUrl,
  TEST_CONFIG.supabaseKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

// Test data fixtures
export const TEST_FIXTURES = {
  cars: [
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Test Tesla Model 3',
      slug: 'test-tesla-model-3',
      brand: 'Tesla',
      model: 'Model 3',
      year: 2023,
      base_price_per_day: 120,
      currency: 'USD',
      availability_status: 'available',
      hidden: false,
      features: ['Autopilot', 'Premium Audio', 'Glass Roof'],
      images: ['https://example.com/tesla-1.jpg'],
      passenger_capacity: 5,
      transmission: 'automatic',
      fuel_type: 'electric',
      min_rental_days: 1,
      max_rental_days: 30,
      security_deposit: 500,
      discount_weekly: 10,
      discount_monthly: 20,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Test BMW M4',
      slug: 'test-bmw-m4',
      brand: 'BMW',
      model: 'M4',
      year: 2023,
      base_price_per_day: 200,
      currency: 'USD',
      availability_status: 'available',
      hidden: false,
      features: ['M Sport Package', 'Harman Kardon Audio', 'M Carbon Seats'],
      images: ['https://example.com/bmw-1.jpg'],
      passenger_capacity: 4,
      transmission: 'automatic',
      fuel_type: 'gasoline',
      min_rental_days: 2,
      max_rental_days: 14,
      security_deposit: 1000,
      discount_weekly: 15,
      discount_monthly: 25,
    },
  ],
  customers: [
    {
      id: '660e8400-e29b-41d4-a716-446655440001',
      email: 'test.user@example.com',
      first_name: 'Test',
      last_name: 'User',
      phone: '+1234567890',
      address: '123 Test Street',
      city: 'Test City',
      state: 'TC',
      country: 'Test Country',
      postal_code: '12345',
    },
  ],
};

/**
 * Helper function to set up test data in the database
 */
export async function setupTestData() {
  try {
    // Insert test cars
    const { error: carsError } = await testSupabase
      .from('cars')
      .upsert(TEST_FIXTURES.cars, { onConflict: 'id' });

    if (carsError) {
      console.error('Failed to insert test cars:', carsError);
      throw carsError;
    }

    // Insert test customers
    const { error: customersError } = await testSupabase
      .from('customers')
      .upsert(TEST_FIXTURES.customers, { onConflict: 'id' });

    if (customersError) {
      console.error('Failed to insert test customers:', customersError);
      throw customersError;
    }

    // Set up car availability for test cars
    const availabilityData = [];
    const startDate = new Date();
    for (let i = 0; i < 90; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];

      for (const car of TEST_FIXTURES.cars) {
        availabilityData.push({
          car_id: car.id,
          date: dateStr,
          status: 'available',
          price_override: null,
        });
      }
    }

    const { error: availabilityError } = await testSupabase
      .from('car_availability')
      .upsert(availabilityData, { onConflict: 'car_id,date' });

    if (availabilityError) {
      console.error('Failed to insert car availability:', availabilityError);
      throw availabilityError;
    }

    console.log('Test data setup completed successfully');
  } catch (error) {
    console.error('Error setting up test data:', error);
    throw error;
  }
}

/**
 * Helper function to clean up test data from the database
 */
export async function cleanupTestData() {
  try {
    // Delete test bookings first (due to foreign key constraints)
    await testSupabase
      .from('bookings')
      .delete()
      .or(`car_id.in.(${TEST_FIXTURES.cars.map(c => c.id).join(',')}),customer_id.in.(${TEST_FIXTURES.customers.map(c => c.id).join(',')})`);

    // Delete test car availability
    await testSupabase
      .from('car_availability')
      .delete()
      .in('car_id', TEST_FIXTURES.cars.map(c => c.id));

    // Delete test cars
    await testSupabase
      .from('cars')
      .delete()
      .in('id', TEST_FIXTURES.cars.map(c => c.id));

    // Delete test customers
    await testSupabase
      .from('customers')
      .delete()
      .in('id', TEST_FIXTURES.customers.map(c => c.id));

    console.log('Test data cleanup completed successfully');
  } catch (error) {
    console.error('Error cleaning up test data:', error);
    // Don't throw here as cleanup errors shouldn't fail tests
  }
}

/**
 * Helper to wait for a specific duration
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper to generate a unique test ID
 */
export function generateTestId(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Helper to make authenticated API requests with proper headers
 */
export async function makeAuthenticatedRequest(
  url: string,
  options: RequestInit = {},
  authToken?: string
): Promise<{ response: Response; data: any }> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${TEST_CONFIG.baseUrl}${url}`, {
    ...options,
    headers,
  });

  let data;
  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }

  return { response, data };
}

/**
 * Helper to create a test booking
 */
export async function createTestBooking(carId: string, customerId?: string) {
  const bookingData = {
    carId,
    startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
    endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 10 days from now
    customerDetails: {
      fullName: 'Test Customer',
      email: 'test.customer@example.com',
      phone: '+1234567890',
    },
    totalPrice: 360,
    currency: 'USD',
    securityDepositAmount: 500,
  };

  const { response, data } = await makeAuthenticatedRequest('/api/bookings', {
    method: 'POST',
    body: JSON.stringify(bookingData),
  });

  return { response, data, bookingData };
}