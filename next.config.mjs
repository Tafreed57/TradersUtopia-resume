/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ SECURITY: Comprehensive security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // ✅ SECURITY: Prevent clickjacking attacks
          {
            key: 'X-Frame-Options',
            value: 'DENY',
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
              "frame-src 'self' https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev https://www.google.com https://www.recaptcha.net https://hcaptcha.com https://*.hcaptcha.com https://challenges.cloudflare.com",
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

  // ✅ WEBPACK: Handle server-only modules and fix clientModules error
  webpack: (config, { isServer }) => {
    // Exclude server-only modules from client bundle
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

    // ✅ FIX: clientModules error - Optimize module resolution
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        ...config.optimization?.splitChunks,
        chunks: 'all',
      },
    };

    // ✅ FIX: clientModules error - Handle dynamic imports better
    config.resolve.alias = {
      ...config.resolve.alias,
      // Ensure consistent module resolution
    };

    return config;
  },

  // ✅ EXPERIMENTAL: Server components external packages
  experimental: {
    serverComponentsExternalPackages: ['web-push', 'resend'],
  },

  // ✅ FIX: clientModules error - Bundle pages router dependencies
  bundlePagesRouterDependencies: true,

  // ✅ FIX: clientModules error - Transpile problematic packages
  transpilePackages: [
    '@emoji-mart/data',
    '@emoji-mart/react',
    '@livekit/components-react',
    '@livekit/components-styles',
    'livekit-client',
    'livekit-server-sdk',
  ],

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
        // pathname: `/a/${process.env.UPLOADTHING_APP_ID}/*`,
      },
      {
        protocol: 'https',
        hostname: 'i.imgur.com',
        port: '',
        pathname: '**',
      },
    ],
    // AWS Amplify image optimization
    domains: ['img.clerk.com', 'utfs.io', 'i.imgur.com'],
  },

  // AWS Amplify configuration
  trailingSlash: false,
  generateEtags: false,
  output: 'standalone', // ✅ This can help with AWS environment variable issues

  // ✅ AWS AMPLIFY: Force environment variables to be available
  env: {
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_ENCRYPTION_KEY: process.env.CLERK_ENCRYPTION_KEY,
  },
};

export default nextConfig;
