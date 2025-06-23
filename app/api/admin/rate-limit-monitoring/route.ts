import { NextRequest, NextResponse } from 'next/server';
import { adminRateLimit, rateLimitViolationHandler } from '@/lib/rate-limit';

// Get rate limit violations (admin only)
export const GET = adminRateLimit(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const minutes = parseInt(searchParams.get('minutes') || '60');
    const identifier = searchParams.get('identifier');

    let violations;
    if (identifier) {
      violations = rateLimitViolationHandler.getViolationsByIdentifier(identifier);
    } else {
      violations = rateLimitViolationHandler.getRecentViolations(minutes);
    }

    // Summary statistics
    const summary = {
      totalViolations: violations.length,
      uniqueIdentifiers: new Set(violations.map(v => v.identifier)).size,
      byEndpoint: violations.reduce((acc, v) => {
        acc[v.endpoint] = (acc[v.endpoint] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      recentViolations: violations.slice(-10), // Last 10 violations
    };

    return NextResponse.json({
      summary,
      violations: violations.slice(-100), // Return max 100 violations
    });
  } catch (error) {
    console.error('Rate limit monitoring error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// Clear rate limit violations (admin only)
export const DELETE = adminRateLimit(async (request: NextRequest) => {
  try {
    rateLimitViolationHandler.clearViolations();
    return NextResponse.json({ 
      success: true, 
      message: 'Rate limit violations cleared' 
    });
  } catch (error) {
    console.error('Rate limit monitoring error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});