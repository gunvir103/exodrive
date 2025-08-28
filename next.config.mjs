/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  output: 'standalone',
  // Security headers for SEO trust signals and security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          // HSTS for production only
          ...(process.env.NODE_ENV === 'production' ? [{
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          }] : [])
        ]
      }
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'placeholder.com',
      },
      {
        protocol: 'https',
        hostname: 'www.exodrive.co',
      },
      {
        protocol: 'https',
        hostname: 'exodrive.co',
      },
      {
        protocol: 'https',
        hostname: 'ncdukddsefogzbqsbfsa.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ]
  },
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
    // Package optimizations for Core Web Vitals
    optimizePackageImports: [
      '@radix-ui/react-*', 
      'lucide-react', 
      '@supabase/supabase-js',
      '@vercel/analytics',
      '@vercel/speed-insights'
    ],
    // Server actions configuration
    serverActions: {
      bodySizeLimit: '2mb'
    },
    // Additional optimizations
    optimizeCss: true
  },
  // Webpack optimizations for Core Web Vitals
  webpack: (config, { isServer }) => {
    // Client-side optimizations
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'stream': 'stream-browserify',
        'crypto': 'crypto-browserify'
      }
      
      // Split chunks for better caching and loading
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10
          },
          ui: {
            test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
            name: 'ui',
            chunks: 'all',
            priority: 20
          }
        }
      }
    }
    
    // Build optimizations
    config.optimization = {
      ...config.optimization,
      moduleIds: 'deterministic',
      chunkIds: 'deterministic',
      minimize: true,
      minimizer: [
        ...(config.optimization.minimizer || []),
      ],
      usedExports: true,
      sideEffects: false
    }
    
    return config
  }
}

export default nextConfig;