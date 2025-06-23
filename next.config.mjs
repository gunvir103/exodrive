/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  output: 'standalone',
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
      {
        protocol: 'https',
        hostname: '**',
      }
    ]
  },
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
    // Package optimizations
    optimizePackageImports: [
      '@radix-ui/react-*', 
      'lucide-react', 
      '@supabase/supabase-js'
    ],
    // Server actions configuration
    serverActions: {
      bodySizeLimit: '2mb'
    },
  },
  // Webpack optimizations
  webpack: (config, { isServer }) => {
    // Client-side optimizations
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'stream': 'stream-browserify',
        'crypto': 'crypto-browserify'
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
      ]
    }
    
    return config
  }
}

export default nextConfig;