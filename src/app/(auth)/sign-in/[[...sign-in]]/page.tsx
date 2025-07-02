'use client';

import { SignIn } from '@clerk/nextjs';
import Image from 'next/image';

export default function Page({
  searchParams,
}: {
  searchParams: { redirect_url?: string };
}) {
  const redirectUrl = searchParams.redirect_url || '/';

  return (
    <div className='min-h-screen flex flex-col justify-center items-center p-4 bg-gradient-to-br from-slate-900 via-gray-900 to-black'>
      {/* Logo and Header */}
      <div className='w-full max-w-md mx-auto mb-8 text-center'>
        <div className='flex justify-center mb-6'>
          <div className='relative w-16 h-16 sm:w-20 sm:h-20 animate-glow'>
            <Image
              src='/logo.png'
              alt='Traders Utopia'
              fill
              className='object-contain'
              priority
            />
          </div>
        </div>
        <h1 className='text-2xl sm:text-3xl font-bold text-white mb-2'>
          Welcome Back
        </h1>
        <p className='text-gray-400 text-sm sm:text-base'>
          Sign in to access your trading community
        </p>
      </div>

      {/* Sign In Form */}
      <div className='w-full max-w-md mx-auto'>
        <div className='glass rounded-2xl p-8 shadow-2xl border border-gray-700/50'>
          <SignIn
            fallbackRedirectUrl={redirectUrl}
            appearance={{
              elements: {
                rootBox: 'w-full',
                card: 'w-full bg-transparent shadow-none border-none',
                headerTitle: 'text-white text-xl font-semibold text-center',
                headerSubtitle: 'text-gray-300 text-sm text-center mt-2',

                // Social buttons styling
                socialButtonsBlockButton: [
                  'w-full bg-white/10 backdrop-blur-sm border border-gray-600/50',
                  'hover:bg-white/20 hover:border-gray-500',
                  'text-white font-medium rounded-xl',
                  'min-h-[48px] transition-all duration-200',
                  'flex items-center justify-center gap-3',
                  'active:scale-[0.98] transform',
                ].join(' '),
                socialButtonsBlockButtonText: 'text-white font-medium',
                socialButtonsIconButton: 'text-white',

                // Form styling
                formFieldInput: [
                  'w-full bg-gray-800/50 border border-gray-600/50',
                  'rounded-xl px-4 py-3 text-white',
                  'placeholder:text-gray-400',
                  'focus:border-yellow-500/50 focus:ring-2 focus:ring-yellow-500/20',
                  'transition-all duration-200',
                  'min-h-[48px]',
                ].join(' '),
                formFieldLabel: 'text-gray-300 font-medium mb-2',

                // Primary button styling
                formButtonPrimary: [
                  'w-full bg-gradient-to-r from-yellow-500 to-yellow-600',
                  'hover:from-yellow-600 hover:to-yellow-700',
                  'text-black font-semibold rounded-xl',
                  'min-h-[48px] transition-all duration-200',
                  'active:scale-[0.98] transform',
                  'shadow-lg hover:shadow-yellow-500/25',
                ].join(' '),

                // Footer styling - improved alignment and spacing
                footerActionText: 'text-gray-400 text-sm inline',
                footerActionLink: [
                  'text-yellow-400 hover:text-yellow-300',
                  'font-medium transition-colors duration-200 inline ml-1',
                ].join(' '),
                footerAction: 'text-center mb-4',

                // Divider styling
                dividerLine: 'bg-gray-600/50',
                dividerText: 'text-gray-400 bg-transparent px-4',

                // OTP styling
                otpCodeFieldInput: [
                  'bg-gray-800/50 border border-gray-600/50',
                  'rounded-lg text-white text-center',
                  'focus:border-yellow-500/50 focus:ring-2 focus:ring-yellow-500/20',
                  'transition-all duration-200',
                  'min-h-[48px] min-w-[48px]',
                ].join(' '),

                // Additional form elements
                formFieldInputShowPasswordButton:
                  'text-gray-400 hover:text-white',
                formFieldAction: 'text-yellow-400 hover:text-yellow-300',
                formResendCodeLink: 'text-yellow-400 hover:text-yellow-300',

                // Error styling
                formFieldErrorText: 'text-red-400 text-sm mt-1',
                alertClerkError:
                  'bg-red-900/20 border border-red-500/30 text-red-400 rounded-xl p-3',

                // Loading states
                spinner: 'text-yellow-500',

                // Mobile optimizations
                formFieldRow: 'mb-4',
                footer: 'mt-6 pt-6 border-t border-gray-700/50',

                // Footer links container - ensure proper alignment
                footerPagesLink:
                  'text-gray-400 hover:text-gray-300 transition-colors duration-200 text-sm',
                footerPages:
                  'flex justify-center items-center gap-6 mt-4 pt-4 border-t border-gray-700/30',
              },
              layout: {
                socialButtonsPlacement: 'top',
                socialButtonsVariant: 'blockButton',
                termsPageUrl: '/terms',
                privacyPageUrl: '/privacy',
              },
              variables: {
                colorPrimary: '#eab308',
                colorDanger: '#ef4444',
                colorSuccess: '#10b981',
                colorWarning: '#f59e0b',
                colorNeutral: '#6b7280',
                fontFamily: 'inherit',
                borderRadius: '0.75rem',
              },
            }}
          />
        </div>
      </div>

      {/* Custom Footer with properly aligned links */}
      <div className='w-full max-w-md mx-auto mt-6'>
        <div className='flex justify-center items-center gap-6 pb-4'>
          <a
            href='/privacy'
            className='text-gray-400 hover:text-gray-300 transition-colors duration-200 text-sm font-medium'
          >
            Privacy
          </a>
          <a
            href='/terms'
            className='text-gray-400 hover:text-gray-300 transition-colors duration-200 text-sm font-medium'
          >
            Terms
          </a>
        </div>
        <p className='text-gray-500 text-xs text-center'>
          By signing in, you agree to our{' '}
          <a
            href='/terms'
            className='text-yellow-400 hover:text-yellow-300 transition-colors'
          >
            Terms of Service
          </a>{' '}
          and{' '}
          <a
            href='/privacy'
            className='text-yellow-400 hover:text-yellow-300 transition-colors'
          >
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}
