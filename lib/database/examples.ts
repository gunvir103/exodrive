/**
 * Examples of using the new pooled database connections
 */

import { withSupabaseClient, withServiceClient } from '../supabase/client';
import { withServerClient } from '../supabase/server';
import { getPooledSupabaseClient, getPooledSupabaseServiceClient } from '../supabase/client';
import { cookies } from 'next/headers';

// Example 1: Using withSupabaseClient for automatic connection management (RECOMMENDED)
export async function fetchUserProfile(userId: string) {
  return withSupabaseClient(async (supabase) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  });
}

// Example 2: Using service client for admin operations
export async function deleteUser(userId: string) {
  return withServiceClient(async (supabase) => {
    // Delete user profile
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);
    
    if (profileError) throw profileError;
    
    // Delete auth user
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    
    if (authError) throw authError;
    
    return { success: true };
  });
}

// Example 3: Server-side usage in route handlers
export async function serverSideExample() {
  const cookieStore = await cookies();
  
  return withServerClient(cookieStore, async (supabase) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('Not authenticated');
    }
    
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', user.id);
    
    if (error) throw error;
    return data;
  });
}

// Example 4: Manual connection management (USE SPARINGLY)
// Only use this pattern when you need fine-grained control
export async function manualConnectionExample() {
  const dbClient = await getPooledSupabaseClient();
  
  try {
    // Perform multiple operations
    const { data: cars } = await dbClient.client
      .from('cars')
      .select('*')
      .limit(10);
    
    const { data: bookings } = await dbClient.client
      .from('bookings')
      .select('*')
      .in('car_id', cars?.map(c => c.id) || []);
    
    return { cars, bookings };
  } finally {
    // CRITICAL: Always release the connection
    dbClient.release();
  }
}

// Example 5: Error handling with connection pooling
export async function errorHandlingExample(carId: string) {
  return withSupabaseClient(async (supabase) => {
    try {
      const { data, error } = await supabase
        .from('cars')
        .select('*')
        .eq('id', carId)
        .single();
      
      if (error) {
        // Connection will be automatically released even on error
        console.error('Database error:', error);
        throw new Error(`Failed to fetch car: ${error.message}`);
      }
      
      return data;
    } catch (error) {
      // Re-throw to maintain error propagation
      // Connection is still automatically released
      throw error;
    }
  });
}

// Example 6: Transaction-like operations
export async function createBookingWithPayment(bookingData: any, paymentData: any) {
  return withServiceClient(async (supabase) => {
    // Insert booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert(bookingData)
      .select()
      .single();
    
    if (bookingError) {
      throw new Error(`Failed to create booking: ${bookingError.message}`);
    }
    
    // Insert payment
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        ...paymentData,
        booking_id: booking.id,
      })
      .select()
      .single();
    
    if (paymentError) {
      // In a real transaction, this would rollback the booking
      // For now, we'll need to manually clean up
      await supabase
        .from('bookings')
        .delete()
        .eq('id', booking.id);
      
      throw new Error(`Failed to create payment: ${paymentError.message}`);
    }
    
    return { booking, payment };
  });
}

// Example 7: Bulk operations with connection reuse
export async function bulkUpdateCarAvailability(updates: Array<{ id: string; available: boolean }>) {
  return withSupabaseClient(async (supabase) => {
    const results = [];
    
    // Reuse the same connection for all updates
    for (const update of updates) {
      const { data, error } = await supabase
        .from('cars')
        .update({ available: update.available })
        .eq('id', update.id)
        .select()
        .single();
      
      if (error) {
        console.error(`Failed to update car ${update.id}:`, error);
        results.push({ id: update.id, success: false, error: error.message });
      } else {
        results.push({ id: update.id, success: true, data });
      }
    }
    
    return results;
  });
}

// Example 8: Monitoring connection health
export async function checkDatabaseHealth() {
  try {
    const result = await withSupabaseClient(async (supabase) => {
      const { count, error } = await supabase
        .from('cars')
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      
      return {
        healthy: true,
        carCount: count,
        timestamp: new Date().toISOString(),
      };
    });
    
    return result;
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}