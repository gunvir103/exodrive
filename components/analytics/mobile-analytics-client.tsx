"use client";

import { useMobileAnalytics } from '../../lib/analytics/mobile-analytics';

export function MobileAnalyticsClient() {
  useMobileAnalytics();
  
  return null;
}
