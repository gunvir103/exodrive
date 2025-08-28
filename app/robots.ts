import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/admin/*',
          '/api/',
          '/api/*',
          '/booking/[token]',
          '/booking/*',
          '/(main)/booking/[token]/',
          '/(main)/booking/[token]/*',
          '/auth/',
          '/auth/*',
          '/_next/',
          '/_next/*',
          '/temp/',
          '/temp/*',
        ],
        crawlDelay: 1, // Be respectful to crawlers - 1 second delay
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/admin/',
          '/admin/*',
          '/api/',
          '/api/*',
          '/booking/[token]',
          '/booking/*',
          '/(main)/booking/[token]/',
          '/(main)/booking/[token]/*',
          '/auth/',
          '/auth/*',
        ],
        // No crawl delay for Googlebot - they're generally well-behaved
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow: [
          '/admin/',
          '/admin/*',
          '/api/',
          '/api/*',
          '/booking/[token]',
          '/booking/*',
          '/(main)/booking/[token]/',
          '/(main)/booking/[token]/*',
          '/auth/',
          '/auth/*',
        ],
        crawlDelay: 2, // Slightly more conservative for Bing
      },
    ],
    sitemap: 'https://www.exodrive.co/sitemap.xml',
    host: 'https://www.exodrive.co',
  }
}