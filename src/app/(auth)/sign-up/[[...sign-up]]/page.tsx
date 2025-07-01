import { SignUp } from '@clerk/nextjs';

export default function Page() {
  return (
    <div className='w-full'>
      <SignUp
        appearance={{
          elements: {
            rootBox: 'w-full',
            card: 'w-full max-w-md mx-auto shadow-2xl border-gray-700 bg-gray-800/90 backdrop-blur-sm',
            headerTitle: 'text-white text-xl sm:text-2xl font-bold',
            headerSubtitle: 'text-gray-300 text-sm sm:text-base',
            socialButtonsBlockButton:
              'bg-white border-gray-200 hover:bg-transparent hover:border-black text-gray-600 hover:text-black min-h-[44px] touch-manipulation',
            socialButtonsBlockButtonText: 'font-semibold text-sm sm:text-base',
            formFieldInput:
              'bg-gray-700 border-gray-600 text-white min-h-[44px] touch-manipulation',
            formButtonPrimary:
              'bg-yellow-500 hover:bg-yellow-600 text-black font-semibold min-h-[44px] touch-manipulation',
            footerActionText: 'text-gray-300 text-sm',
            footerActionLink: 'text-yellow-400 hover:text-yellow-300',
            dividerText: 'text-gray-400 text-sm',
            otpCodeFieldInput:
              'bg-gray-700 border-gray-600 text-white min-h-[44px] touch-manipulation',
          },
        }}
      />
    </div>
  );
}
