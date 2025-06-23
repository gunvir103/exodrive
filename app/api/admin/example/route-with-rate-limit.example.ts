import { NextRequest, NextResponse } from 'next/server';
import { adminRateLimit } from '@/lib/rate-limit';

// Example of admin endpoint with rate limiting
export const GET = adminRateLimit(async (request: NextRequest) => {
  try {
    // Admin endpoints require authentication
    // The adminRateLimit middleware expects a user ID to be available
    
    // Your admin logic here
    const data = {
      // ... admin data
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error('Admin endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = adminRateLimit(async (request: NextRequest) => {
  try {
    const body = await request.json();
    
    // Process admin action...
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});