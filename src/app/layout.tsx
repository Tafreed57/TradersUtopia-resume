import { ourFileRouter } from '@/app/api/uploadthing/core';
import '@/app/globals.css';
import { ModalProvider } from '@/contexts/modal-provider';
import { QueryProvider } from '@/contexts/query-provider';
import { ThemeProvider } from '@/contexts/theme-provider';
import { LoadingProvider } from '@/contexts/loading-provider';
import { AuthWrapper } from '@/components/auth-wrapper';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { cn } from '@/lib/utils';
import { ClerkProvider } from '@clerk/nextjs';
import { NextSSRPlugin } from '@uploadthing/react/next-ssr-plugin';
import type { Metadata, Viewport } from 'next';
import { Open_Sans } from 'next/font/google';
import { extractRouterConfig } from 'uploadthing/server';
import { Toaster } from 'sonner';
import { ServiceWorkerHandler } from '@/components/service-worker-handler';

const open_sans = Open_Sans({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export const metadata: Metadata = {
  title: {
    default: 'TradersUtopia - Professional Trading Platform',
    template: '%s | TradersUtopia',
  },
  description:
    'Professional Trading Signals & Expert Education Platform - Join 2,847+ successful traders with real-time alerts, expert analysis, and live coaching sessions.',
  keywords: [
    'trading signals',
    'forex trading',
    'crypto trading',
    'stock market',
    'professional trading',
    'trading education',
    'market analysis',
    'trading platform',
  ],
  authors: [{ name: 'TradersUtopia' }],
  creator: 'TradersUtopia',
  publisher: 'TradersUtopia',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    title: 'TradersUtopia - Professional Trading Platform',
    description:
      'Join 2,847+ successful traders with real-time alerts, expert analysis, and live coaching sessions.',
    url: 'https://tradersutopia.com',
    siteName: 'TradersUtopia',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        alt: 'TradersUtopia - Professional Trading Platform',
      },
    ],
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TradersUtopia - Professional Trading Platform',
    description:
      'Join 2,847+ successful traders with real-time alerts, expert analysis, and live coaching sessions.',
    images: ['/logo.png'],
    creator: '@tradersutopia',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-2.png', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: '/logo.png',
    apple: [{ url: '/apple-icon.png', sizes: '180x180' }],
  },
  manifest: '/site.webmanifest',
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'mobile-web-app-capable': 'yes',
    'application-name': 'TradersUtopia',
    'msapplication-TileColor': '#000000',
    'msapplication-config': '/browserconfig.xml',
    'permissions-policy':
      'accelerometer=(), gyroscope=(), microphone=(), camera=(), geolocation=()',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body
        className={cn(
          open_sans.className,
          'bg-white dark:bg-gradient-to-br dark:from-gray-900/95 dark:via-gray-800/90 dark:to-gray-900/95 overflow-visible min-h-screen'
        )}
      >
        <ClerkProvider
          appearance={{
            variables: { colorPrimary: '#000000' },
            elements: {
              formButtonPrimary:
                'bg-black border border-black border-solid hover:bg-white hover:text-black',
              socialButtonsBlockButton:
                'bg-white border-gray-200 hover:bg-transparent hover:border-black text-gray-600 hover:text-black',
              socialButtonsBlockButtonText: 'font-semibold',
              formButtonReset:
                'bg-white border border-solid border-gray-200 hover:bg-transparent hover:border-black text-gray-500 hover:text-black',
              membersPageInviteButton:
                'bg-black border border-black border-solid hover:bg-white hover:text-black',
              card: 'bg-[#fafafa]',
            },
          }}
        >
          <ThemeProvider
            attribute='class'
            defaultTheme='dark'
            enableSystem={false}
            storageKey='traders-utopia-theme'
            disableTransitionOnChange
          >
            <NextSSRPlugin routerConfig={extractRouterConfig(ourFileRouter)} />
            <ErrorBoundary>
              <LoadingProvider>
                <QueryProvider>
                  <AuthWrapper>
                    <ModalProvider />
                    <ServiceWorkerHandler />
                    <Toaster
                      position='top-right'
                      expand={true}
                      richColors
                      closeButton
                      className='md:max-w-md sm:max-w-sm max-w-[calc(100vw-2rem)]'
                      toastOptions={{
                        className:
                          'text-sm p-4 min-h-[48px] touch-manipulation',
                        style: {
                          minHeight: '48px',
                          fontSize: '14px',
                          padding: '16px',
                        },
                      }}
                    />
                    {children}
                  </AuthWrapper>
                </QueryProvider>
              </LoadingProvider>
            </ErrorBoundary>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
