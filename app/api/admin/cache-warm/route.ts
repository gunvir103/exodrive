import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { cacheWarmer } from '@/lib/redis/cache-warmer';
import { z } from 'zod';

// Request body schema
const cacheWarmRequestSchema = z.object({
  warmPopularCars: z.boolean().optional().default(true),
  warmUpcomingAvailability: z.boolean().optional().default(true),
  popularCarsLimit: z.number().int().positive().max(50).optional().default(10),
  availabilityDays: z.number().int().positive().max(30).optional().default(7),
});

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(request.cookies as any);
  
  try {
    // Check admin authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Parse request body
    let options = {};
    try {
      const body = await request.json();
      options = cacheWarmRequestSchema.parse(body);
    } catch (error) {
      // If no body or invalid body, use defaults
      options = cacheWarmRequestSchema.parse({});
    }

    // Log the warming request
    console.log('[CacheWarm API] Admin user', user.email, 'triggered cache warming with options:', options);

    // Perform cache warming
    const metrics = await cacheWarmer.warmCache(options);

    // Log completion
    console.log('[CacheWarm API] Cache warming completed:', {
      duration: `${metrics.duration}ms`,
      keysWarmed: metrics.keysWarmed,
      status: metrics.status,
      errors: metrics.errors.length
    });

    // Return metrics to admin
    return NextResponse.json({
      success: metrics.status !== 'failed',
      metrics: {
        startTime: metrics.startTime.toISOString(),
        endTime: metrics.endTime.toISOString(),
        duration: metrics.duration,
        keysWarmed: metrics.keysWarmed,
        status: metrics.status,
        errors: metrics.errors
      },
      message: `Cache warming ${metrics.status}. Warmed ${metrics.keysWarmed} keys in ${metrics.duration}ms.`
    });

  } catch (error: any) {
    console.error('[CacheWarm API] Error during cache warming:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error during cache warming', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(request.cookies as any);
  
  try {
    // Check admin authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Get last warming metrics
    const metrics = cacheWarmer.getMetrics();

    return NextResponse.json({
      success: true,
      lastWarming: metrics.startTime.getTime() > 0 ? {
        startTime: metrics.startTime.toISOString(),
        endTime: metrics.endTime.toISOString(),
        duration: metrics.duration,
        keysWarmed: metrics.keysWarmed,
        status: metrics.status,
        errors: metrics.errors
      } : null,
      message: metrics.startTime.getTime() > 0 
        ? `Last warming: ${metrics.status} - ${metrics.keysWarmed} keys in ${metrics.duration}ms`
        : 'No cache warming has been performed yet'
    });

  } catch (error: any) {
    console.error('[CacheWarm API] Error getting metrics:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}