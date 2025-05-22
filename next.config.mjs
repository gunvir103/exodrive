let userConfig = undefined
try {
  // try to import ESM first
  userConfig = await import('./v0-user-next.config.mjs')
} catch (e) {
  try {
    // fallback to CJS import
    userConfig = await import("./v0-user-next.config");
  } catch (innerError) {
    // ignore error
  }
}

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
    domains: ['localhost', 'placeholder.com', 'www.exodrive.co', 'exodrive.co', 'ncdukddsefogzbqsbfsa.supabase.co'],
    remotePatterns: [
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
    }
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

if (userConfig) {
  // ESM imports will have a "default" property
  const config = userConfig.default || userConfig

  for (const key in config) {
    if (
      typeof nextConfig[key] === 'object' &&
      !Array.isArray(nextConfig[key])
    ) {
      nextConfig[key] = {
        ...nextConfig[key],
        ...config[key],
      }
    } else {
      nextConfig[key] = config[key]
    }
  }
}

export default nextConfig;