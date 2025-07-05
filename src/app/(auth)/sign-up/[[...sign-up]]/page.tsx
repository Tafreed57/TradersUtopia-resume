'use client';

import { SignUp } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function Page({
  searchParams,
}: {
  searchParams: { redirect_url?: string };
}) {
  const redirectUrl = searchParams.redirect_url || '/';
  const router = useRouter();

  const handleBack = () => {
    // Try to go back in history, fallback to home page
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  return (
    <div
      className='min-h-screen min-h-[100vh] min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-slate-900 via-gray-900 to-black p-4'
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Back Button */}
      <button
        onClick={handleBack}
        className='fixed top-4 left-4 z-50 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-gray-600/50 hover:border-gray-500 rounded-xl text-white font-medium transition-all duration-200 active:scale-[0.98] transform'
      >
        <ArrowLeft className='w-4 h-4' />
        <span className='hidden sm:inline'>Back</span>
      </button>

      <div className='w-full max-w-md'>
        <SignUp
          fallbackRedirectUrl={redirectUrl}
          appearance={{
            elements: {
              rootBox: 'w-full flex justify-center',
              card: 'w-full max-w-md bg-transparent shadow-none border-none',

              // Header customization
              header: 'mb-8',
              headerTitle:
                'text-white text-2xl sm:text-3xl font-bold text-center mb-2',
              headerSubtitle: 'text-gray-400 text-base text-center',

              // Main form container
              main: 'glass rounded-2xl p-6 sm:p-8 shadow-2xl border border-gray-700/50',

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

              // Footer styling
              footer: 'mt-6 pt-6 border-t border-gray-700/50',
              footerActionText: 'text-gray-400 text-sm',
              footerActionLink:
                'text-yellow-400 hover:text-yellow-300 font-medium transition-colors duration-200 ml-1',
              footerAction: 'text-center',

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

              // Form field spacing
              formFieldRow: 'mb-4',

              // Footer links
              footerPagesLink:
                'text-gray-400 hover:text-gray-300 transition-colors duration-200 text-sm',
              footerPages:
                'flex justify-center items-center gap-6 mt-4 pt-4 border-t border-gray-700/30',
            },
            layout: {
              socialButtonsPlacement: 'top',
              socialButtonsVariant: 'blockButton',
              helpPageUrl: undefined,
              privacyPageUrl: '/privacy',
              termsPageUrl: '/terms',
              logoImageUrl: '/logo.png',
              showOptionalFields: false,
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
  );
}
