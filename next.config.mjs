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
					// ✅ SECURITY: Control resource loading (Content Security Policy)
					{
						key: 'Content-Security-Policy',
						value: [
							"default-src 'self'",
							"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev https://cdn.jsdelivr.net",
							"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
							"font-src 'self' https://fonts.gstatic.com",
							"img-src 'self' data: https: blob:",
							"media-src 'self' https:",
							"connect-src 'self' https: wss: blob:",
							"frame-src 'self' https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev",
							"object-src 'none'",
							"base-uri 'self'",
							"form-action 'self'"
						].join('; ')
					},
					// ✅ SECURITY: Enforce HTTPS (only in production)
					...(process.env.NODE_ENV === 'production' ? [{
						key: 'Strict-Transport-Security',
						value: 'max-age=31536000; includeSubDomains; preload'
					}] : []),
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
};

export default nextConfig;
