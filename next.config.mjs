/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ MEMORY: Optimize build performance and memory usage
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // ✅ STABILITY: Simplified output settings to prevent chunk loading issues
  generateEtags: false,
  trailingSlash: false,

  // ✅ MEMORY: Reduce bundle analyzer overhead
  productionBrowserSourceMaps: false,

  // ✅ SECURITY: Comprehensive security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // ✅ SECURITY: Prevent clickjacking attacks (allow same origin for our own content)
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          // ✅ SECURITY: Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // ✅ SECURITY: Control referrer information
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // ✅ SECURITY: Prevent XSS attacks
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // ✅ SECURITY: Control resource loading (Content Security Policy)
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev https://cdn.jsdelivr.net https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://hcaptcha.com https://*.hcaptcha.com https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.gstatic.com https://hcaptcha.com https://*.hcaptcha.com",
              "font-src 'self' https://fonts.gstatic.com https://www.gstatic.com",
              "img-src 'self' data: https: blob:",
              "media-src 'self' https:",
              "connect-src 'self' https: wss: blob:",
              "frame-src 'self' https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev https://www.google.com https://www.recaptcha.net https://hcaptcha.com https://*.hcaptcha.com https://challenges.cloudflare.com https://www.youtube.com https://youtube.com https://*.youtube.com",
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          // ✅ SECURITY: Enforce HTTPS (only in production)
          ...(process.env.NODE_ENV === 'production'
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=31536000; includeSubDomains; preload',
                },
              ]
            : []),
          // ✅ SECURITY: Permissions policy
          {
            key: 'Permissions-Policy',
            value: [
              'camera=()',
              'microphone=()',
              'geolocation=()',
              'payment=()',
              'usb=()',
              'magnetometer=()',
              'gyroscope=()',
              'accelerometer=()',
            ].join(', '),
          },
        ],
      },
    ];
  },

  // ✅ WEBPACK: Simplified and stable configuration to prevent chunk loading errors
  webpack: (config, { isServer, dev }) => {
    // ✅ STABILITY: Only apply optimizations in production and avoid aggressive chunk splitting
    if (!dev && !isServer) {
      // Simplified chunk splitting to prevent module loading errors
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
            },
          },
        },
      };
    }

    // ✅ STABILITY: Exclude server-only modules from client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        dns: false,
        tls: false,
        assert: false,
        path: false,
        fs: false,
        'web-push': false,
      };
    }

    return config;
  },

  // ✅ EXPERIMENTAL: Only stable features
  experimental: {
    serverComponentsExternalPackages: ['web-push', 'resend'],
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
        port: '',
      },
      {
        protocol: 'https',
        hostname: 'utfs.io',
      },
      {
        protocol: 'https',
        hostname: 'i.imgur.com',
        port: '',
        pathname: '**',
      },
    ],
  },

  // ✅ AWS AMPLIFY: Force environment variables to be available
  env: {
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_ENCRYPTION_KEY: process.env.CLERK_ENCRYPTION_KEY,
  },
};

export default nextConfig;
