"use client";

import { useEffect } from 'react';
import { isMobileDevice } from '../../lib/utils';

export function useMobileAnalytics() {
  useEffect(() => {
    if (isMobileDevice()) {
      const event = new CustomEvent('speed-insights-mobile-init');
      window.dispatchEvent(event);
      
      console.log('[Analytics] Mobile device detected, initializing mobile analytics');
    }
  }, []);
  
  return null;
}
