/** @type {import('next').NextConfig} */
const nextConfig = {
	// ✅ SECURITY: Comprehensive security headers
	async headers() {
		// Skip security headers in development to prevent CSP issues
		if (process.env.NODE_ENV === 'development') {
			return [];
		}
		
		return [
			{
				source: '/(.*)',
				headers: [
					// ✅ SECURITY: Prevent clickjacking attacks
					{
						key: 'X-Frame-Options',
						value: 'DENY'
					},
					// ✅ SECURITY: Prevent MIME type sniffing
					{
						key: 'X-Content-Type-Options',
						value: 'nosniff'
					},
					// ✅ SECURITY: Control referrer information
					{
						key: 'Referrer-Policy',
						value: 'strict-origin-when-cross-origin'
					},
					// ✅ SECURITY: Prevent XSS attacks
					{
						key: 'X-XSS-Protection',
						value: '1; mode=block'
					},
					// ✅ SECURITY: Enhanced Content Security Policy
					{
						key: 'Content-Security-Policy',
						value: [
							"default-src 'self'",
							"script-src 'self' 'unsafe-inline' https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev https://cdn.jsdelivr.net https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://hcaptcha.com https://*.hcaptcha.com https://challenges.cloudflare.com https://www.youtube.com https://youtube.com",
							"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.gstatic.com https://hcaptcha.com https://*.hcaptcha.com",
							"font-src 'self' https://fonts.gstatic.com https://www.gstatic.com",
							"img-src 'self' data: https: blob:",
							"media-src 'self' https: blob:",
							"connect-src 'self' https: wss: blob:",
							"frame-src 'self' https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev https://www.google.com https://www.recaptcha.net https://hcaptcha.com https://*.hcaptcha.com https://challenges.cloudflare.com https://www.youtube.com https://youtube.com",
							"worker-src 'self' blob:",
							"object-src 'none'",
							"base-uri 'self'",
							"form-action 'self'",
							"upgrade-insecure-requests"
						].join('; ')
					},
					// ✅ SECURITY: Enforce HTTPS (only in production)
					{
						key: 'Strict-Transport-Security',
						value: 'max-age=31536000; includeSubDomains; preload'
					},
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
							'accelerometer=()'
						].join(', ')
					}
				]
			}
		];
	},

	// ✅ WEBPACK: Handle server-only modules
	webpack: (config, { isServer, dev }) => {
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

		// Only apply optimizations in production
		if (!dev && !isServer) {
			// Remove console.log statements in production client-side code
			config.optimization.minimizer.forEach((plugin) => {
				if (plugin.constructor.name === 'TerserPlugin') {
					plugin.options.terserOptions.compress.drop_console = true;
				}
			});
		}
		return config;
	},

	// ✅ EXPERIMENTAL: Server components external packages
	experimental: {
		serverComponentsExternalPackages: [
			"web-push",
			"resend",
		],
		// Security-focused optimizations
		optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
	},

	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "img.clerk.com",
				port: "",
			},
			{
				protocol: "https",
				hostname: "utfs.io",
				// pathname: `/a/${process.env.UPLOADTHING_APP_ID}/*`,
			},
			{
				protocol: "https",
				hostname: "i.imgur.com",
				port: "",
				pathname: "**",
			},
		],
	},

	// ✅ SECURITY: Strict production optimization
	compiler: {
		removeConsole: process.env.NODE_ENV === 'production',
	},
};

export default nextConfig;
