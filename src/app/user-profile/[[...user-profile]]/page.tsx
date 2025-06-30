'use client';

import { UserProfile } from '@clerk/nextjs';

export default function UserProfilePage() {
  return (
    <div className='min-h-screen bg-gray-900 py-8'>
      <div className='max-w-4xl mx-auto px-4'>
        <div className='mb-6'>
          <h1 className='text-2xl font-bold text-gray-900 mb-2'>
            User Profile Management
          </h1>
          <p className='text-gray-600'>
            Manage your account settings, security options, and personal
            information.
          </p>
        </div>

        <div className='bg-gray-800 rounded-lg shadow-sm border'>
          <UserProfile
            appearance={{
              elements: {
                rootBox: 'w-full',
                card: 'shadow-none border-0 bg-transparent',
                navbar: 'hidden',
                navbarMobileMenuButton: 'hidden',
                headerTitle: 'text-xl font-semibold text-gray-900',
                headerSubtitle: 'text-gray-600',
              },
              variables: {
                colorPrimary: '#6366f1',
              },
            }}
            routing='path'
            path='/user-profile'
          />
        </div>

        {/* Custom Actions */}
        <div className='mt-6 flex gap-3'>
          <button
            onClick={() => window.open('/user/password', '_blank')}
            className='inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
          >
            Password Management
          </button>
          <button
            onClick={() => window.close()}
            className='inline-flex items-center px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors'
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
}
