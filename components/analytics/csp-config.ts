// Content Security Policy configuration for analytics
export const analyticsCSPSources = {
  scriptSrc: [
    "'self'",
    "'unsafe-inline'", // Required for gtag inline scripts
    "https://connect.facebook.net",
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
  ],
  connectSrc: [
    "'self'",
    "https://www.facebook.com",
    "https://connect.facebook.net",
    "https://www.google-analytics.com",
    "https://analytics.google.com",
    "https://stats.g.doubleclick.net",
  ],
  imgSrc: [
    "'self'",
    "https://www.facebook.com",
    "https://www.google-analytics.com",
    "https://stats.g.doubleclick.net",
  ],
  frameSrc: [
    "'self'",
    "https://www.facebook.com",
  ],
}

// Helper to generate CSP header
export function generateCSPHeader(additionalSources?: Partial<typeof analyticsCSPSources>): string {
  const merged = {
    scriptSrc: [...analyticsCSPSources.scriptSrc, ...(additionalSources?.scriptSrc || [])],
    connectSrc: [...analyticsCSPSources.connectSrc, ...(additionalSources?.connectSrc || [])],
    imgSrc: [...analyticsCSPSources.imgSrc, ...(additionalSources?.imgSrc || [])],
    frameSrc: [...analyticsCSPSources.frameSrc, ...(additionalSources?.frameSrc || [])],
  }

  return [
    `script-src ${merged.scriptSrc.join(' ')}`,
    `connect-src ${merged.connectSrc.join(' ')}`,
    `img-src ${merged.imgSrc.join(' ')}`,
    `frame-src ${merged.frameSrc.join(' ')}`,
  ].join('; ')
}