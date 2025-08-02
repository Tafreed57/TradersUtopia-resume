'use client';

import { SignUp } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import AuthNavigation from '@/components/auth-navigation';

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
    <>
      <style jsx global>{`
        /* Hide ALL Clerk footer elements completely */
        .cl-footer,
        .cl-footerPages,
        .cl-footerPagesLink,
        .cl-powered-by,
        .cl-badge,
        [data-clerk-element='footer'],
        [data-clerk-element='footerPages'],
        [data-clerk-element='footerPagesLink'],
        [data-clerk-element='poweredBy'],
        [data-clerk-element='badge'],
        div[class*='poweredBy'],
        div[class*='footer__powered'],
        div[class*='cl-footer'],
        div[class*='cl-badge'],
        div[class*='developmentBadge'] {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
          overflow: hidden !important;
        }

        /* Remove white background from Clerk components */
        .cl-rootBox,
        .cl-card,
        .cl-main {
          background: transparent !important;
        }

        /* Force white text for email verification elements */
        .cl-identityPreview,
        .cl-identityPreviewText,
        .cl-verificationRoot,
        .cl-signUp-verifyEmailAddressForm,
        .cl-main .cl-text,
        .cl-main .cl-textMuted,
        .cl-main .cl-textSecondary,
        [data-clerk-element='identityPreview'],
        [data-clerk-element='identityPreviewText'] {
          color: white !important;
        }

        /* Target verification form text elements */
        .cl-verificationRoot *:not(input):not(button),
        .cl-signUp-verifyEmailAddressForm *:not(input):not(button) {
          color: white !important;
        }

        /* Ensure OTP container fits properly */
        .cl-otpCodeField,
        [data-clerk-element='otpCodeField'] {
          width: 100% !important;
          display: flex !important;
          justify-content: center !important;
          flex-wrap: nowrap !important;
        }
      `}</style>
      <div
        className='min-h-screen min-h-[100vh] min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-slate-900 via-gray-900 to-black p-4 overflow-auto'
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: `calc(1rem + env(safe-area-inset-top))`,
          paddingBottom: `calc(1rem + env(safe-area-inset-bottom))`,
          paddingLeft: `calc(1rem + env(safe-area-inset-left))`,
          paddingRight: `calc(1rem + env(safe-area-inset-right))`,
        }}
      >
        {/* Back Button */}
        <button
          onClick={handleBack}
          className='fixed z-50 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-gray-600/50 hover:border-gray-500 rounded-xl text-white font-medium transition-all duration-200 active:scale-[0.98] transform'
          style={{
            top: `calc(1rem + env(safe-area-inset-top))`,
            left: `calc(1rem + env(safe-area-inset-left))`,
          }}
        >
          <ArrowLeft className='w-4 h-4' />
          <span className='hidden sm:inline'>Back</span>
        </button>

        <div className='w-full max-w-sm sm:max-w-md my-auto'>
          <SignUp
            fallbackRedirectUrl={redirectUrl}
            appearance={{
              elements: {
                rootBox: 'w-full flex justify-center',
                card: 'w-full bg-transparent shadow-none border-none',

                // Header customization - Enhanced for verification step
                header: 'mb-6 sm:mb-8',
                headerTitle:
                  'text-white text-2xl sm:text-3xl font-bold text-center mb-3 leading-tight',
                headerSubtitle:
                  'text-gray-300 text-sm sm:text-base text-center leading-relaxed px-2',

                // Main form container - Enhanced spacing and layout
                main: 'glass rounded-2xl p-6 sm:p-8 lg:p-10 shadow-2xl border border-gray-700/50 w-full',

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

                // Primary button styling - Enhanced
                formButtonPrimary: [
                  'w-full bg-gradient-to-r from-yellow-500 to-yellow-600',
                  'hover:from-yellow-600 hover:to-yellow-700',
                  'text-black font-semibold rounded-xl',
                  'min-h-[50px] sm:min-h-[52px] transition-all duration-200',
                  'active:scale-[0.98] transform',
                  'shadow-lg hover:shadow-yellow-500/25',
                  'text-base sm:text-lg',
                  'mt-4 sm:mt-6', // Better spacing above button
                ].join(' '),

                // Footer styling - completely hidden
                footer: 'hidden',
                footerActionText: 'hidden',
                footerActionLink: 'hidden',
                footerAction: 'hidden',

                // Divider styling
                dividerLine: 'bg-gray-600/50',
                dividerText: 'text-gray-400 bg-transparent px-4',

                // OTP styling - Balanced sizing for proper fit without cutoff
                otpCodeFieldInput: [
                  'bg-gray-800/50 border border-gray-600/50',
                  'rounded-lg text-white text-center text-sm font-semibold',
                  'focus:border-yellow-500/50 focus:ring-2 focus:ring-yellow-500/20',
                  'transition-all duration-200',
                  'w-9 h-9 sm:w-11 sm:h-11', // Balanced sizing - not too small, not too big
                  'flex-shrink-0', // Prevent shrinking
                ].join(' '),

                // OTP container styling - Optimal spacing
                otpCodeField:
                  'flex justify-center items-center gap-1 my-4 sm:my-6 px-2 w-full',

                // Additional form elements
                formFieldInputShowPasswordButton:
                  'text-gray-400 hover:text-white',
                formFieldAction:
                  'text-yellow-400 hover:text-yellow-300 font-medium',
                formResendCodeLink: [
                  'text-yellow-400 hover:text-yellow-300',
                  'font-medium text-sm sm:text-base',
                  'transition-colors duration-200',
                  'block text-center mt-4 mb-2',
                  'underline underline-offset-2 hover:underline-offset-4',
                ].join(' '),

                // Error styling
                formFieldErrorText: 'text-red-400 text-sm mt-1',
                alertClerkError:
                  'bg-red-900/20 border border-red-500/30 text-red-400 rounded-xl p-3',

                // Loading states
                spinner: 'text-yellow-500',

                // Form field spacing - Enhanced for verification
                formFieldRow: 'mb-4 sm:mb-6',

                // Verification specific elements
                verificationLevelTwo: 'space-y-4 sm:space-y-6',
                verificationLevelTwoFormField: 'space-y-3',

                // Email verification text styling
                identityPreview: 'text-white font-medium',
                identityPreviewText: 'text-white',
                identityPreviewEditButton:
                  'text-yellow-400 hover:text-yellow-300',

                // General text elements that might show email
                text: 'text-white',
                textMuted: 'text-gray-300',
                textSecondary: 'text-gray-300',
              },
              layout: {
                socialButtonsPlacement: 'top',
                socialButtonsVariant: 'blockButton',
                helpPageUrl: undefined,
                privacyPageUrl: undefined,
                termsPageUrl: undefined,
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
          <AuthNavigation mode='signup' redirectUrl={redirectUrl} />
        </div>
      </div>
    </>
  );
}
