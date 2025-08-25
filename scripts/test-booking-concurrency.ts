#!/usr/bin/env bun

/**
 * Test script to verify the booking race condition fix
 * This script simulates concurrent booking attempts for the same car and dates
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test configuration
const TEST_CAR_ID = process.argv[2]; // Pass car ID as argument
const TEST_START_DATE = '2025-07-01';
const TEST_END_DATE = '2025-07-05';
const CONCURRENT_REQUESTS = 5;

if (!TEST_CAR_ID) {
  console.error('Usage: bun run test-booking-concurrency.ts <car-id>');
  process.exit(1);
}

interface BookingAttempt {
  attemptNumber: number;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: string;
  bookingId?: string;
}

async function createBooking(attemptNumber: number): Promise<BookingAttempt> {
  const startTime = Date.now();
  const attempt: BookingAttempt = {
    attemptNumber,
    startTime,
    success: false,
  };

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        carId: TEST_CAR_ID,
        startDate: TEST_START_DATE,
        endDate: TEST_END_DATE,
        customerDetails: {
          fullName: `Test User ${attemptNumber}`,
          email: `test${attemptNumber}_${Date.now()}@example.com`,
          phone: '+1234567890',
        },
        totalPrice: 500,
        currency: 'USD',
        securityDepositAmount: 100,
      }),
    });

    const data = await response.json();
    attempt.endTime = Date.now();
    attempt.duration = attempt.endTime - attempt.startTime;

    if (response.ok) {
      attempt.success = true;
      attempt.bookingId = data.bookingId;
    } else {
      attempt.error = data.error || data.details || 'Unknown error';
    }
  } catch (error) {
    attempt.endTime = Date.now();
    attempt.duration = attempt.endTime - attempt.startTime;
    attempt.error = error instanceof Error ? error.message : 'Unknown error';
  }

  return attempt;
}

async function cleanupTestBookings(bookingIds: string[]) {
  console.log('\\nCleaning up test bookings...');
  
  for (const bookingId of bookingIds) {
    try {
      // Delete booking events first
      await supabase
        .from('booking_events')
        .delete()
        .eq('booking_id', bookingId);
      
      // Delete car availability records
      await supabase
        .from('car_availability')
        .delete()
        .eq('booking_id', bookingId);
      
      // Delete the booking
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId);
      
      if (error) {
        console.error(`Failed to delete booking ${bookingId}:`, error);
      } else {
        console.log(`✓ Deleted booking ${bookingId}`);
      }
    } catch (error) {
      console.error(`Error cleaning up booking ${bookingId}:`, error);
    }
  }
}

async function main() {
  console.log(`Testing concurrent booking creation for car ${TEST_CAR_ID}`);
  console.log(`Dates: ${TEST_START_DATE} to ${TEST_END_DATE}`);
  console.log(`Concurrent requests: ${CONCURRENT_REQUESTS}\\n`);

  // Check if car exists
  const { data: car, error: carError } = await supabase
    .from('cars')
    .select('id, name')
    .eq('id', TEST_CAR_ID)
    .single();

  if (carError || !car) {
    console.error('Car not found:', TEST_CAR_ID);
    process.exit(1);
  }

  console.log(`Car found: ${car.name}\\n`);

  // Create concurrent booking attempts
  const promises = Array.from({ length: CONCURRENT_REQUESTS }, (_, i) => 
    createBooking(i + 1)
  );

  console.log('Sending concurrent booking requests...');
  const startTime = Date.now();
  const results = await Promise.all(promises);
  const totalDuration = Date.now() - startTime;

  // Analyze results
  console.log(`\\nAll requests completed in ${totalDuration}ms\\n`);
  console.log('Results:');
  console.log('========');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const successfulBookingIds = successful.map(r => r.bookingId!);

  results.forEach(result => {
    const status = result.success ? '✓ SUCCESS' : '✗ FAILED';
    const details = result.success 
      ? `Booking ID: ${result.bookingId}` 
      : `Error: ${result.error}`;
    console.log(`Attempt ${result.attemptNumber}: ${status} (${result.duration}ms) - ${details}`);
  });

  console.log(`\\nSummary:`);
  console.log(`- Successful bookings: ${successful.length}`);
  console.log(`- Failed attempts: ${failed.length}`);
  console.log(`- Total duration: ${totalDuration}ms`);

  // Verify only one booking was created
  if (successful.length === 1) {
    console.log('\\n✓ PASS: Exactly one booking was created (race condition prevented)');
  } else if (successful.length === 0) {
    console.log('\\n✗ FAIL: No bookings were created');
  } else {
    console.log(`\\n✗ FAIL: Multiple bookings were created (${successful.length})`);
  }

  // Group errors
  const errorGroups = failed.reduce((acc, result) => {
    const error = result.error || 'Unknown';
    acc[error] = (acc[error] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (Object.keys(errorGroups).length > 0) {
    console.log('\\nError breakdown:');
    Object.entries(errorGroups).forEach(([error, count]) => {
      console.log(`- ${error}: ${count} occurrence(s)`);
    });
  }

  // Cleanup test bookings
  if (successfulBookingIds.length > 0) {
    await cleanupTestBookings(successfulBookingIds);
  }
}

main().catch(console.error);