# Analytics Components

This directory contains secure analytics implementations that replace unsafe `dangerouslySetInnerHTML` usage.

## Components

### AnalyticsProvider

A secure analytics provider component that handles:
- Meta Pixel (Facebook) tracking
- Google Analytics tracking
- Environment variable validation
- CSP-compliant script loading

#### Features

1. **No dangerouslySetInnerHTML**: Uses Next.js Script component and useEffect for safe initialization
2. **Environment Variable Validation**: Validates pixel IDs and analytics IDs format
3. **Type Safety**: Full TypeScript support with proper global type definitions
4. **CSP Compliance**: Works with Content Security Policy headers

#### Usage

```tsx
import { AnalyticsProvider } from '@/components/analytics/analytics-provider'

// In your layout or app component
<AnalyticsProvider />
```

The component automatically reads from environment variables:
- `NEXT_PUBLIC_META_PIXEL_ID`: Your Meta/Facebook Pixel ID
- `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID`: Your Google Analytics ID

#### Helper Functions

```tsx
import { trackEvent, trackCustomEvent } from '@/components/analytics/analytics-provider'

// Track standard events
trackEvent('Purchase', { value: 100, currency: 'USD' })

// Track custom events
trackCustomEvent('CarViewed', { carModel: 'Ferrari 488' })
```

### CSP Configuration

The `csp-config.ts` file provides Content Security Policy sources required for analytics:

```tsx
import { analyticsCSPSources, generateCSPHeader } from '@/components/analytics/csp-config'

// Use in your security headers
const cspHeader = generateCSPHeader()
```

## Security Improvements

1. **XSS Prevention**: No direct HTML injection, all scripts loaded safely
2. **Input Validation**: IDs are validated before use
3. **CSP Compatible**: Works with strict Content Security Policy
4. **Type Safety**: Full TypeScript support prevents runtime errors

## Environment Variables

Add these to your `.env.local`:

```
NEXT_PUBLIC_META_PIXEL_ID=your_pixel_id_here
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
```

## Migration from Unsafe Implementation

The old implementation used `dangerouslySetInnerHTML` which could lead to XSS vulnerabilities if environment variables contained malicious code. The new implementation:

1. Loads scripts using Next.js Script component
2. Initializes tracking in useEffect hooks
3. Validates all inputs
4. Provides type-safe tracking functions