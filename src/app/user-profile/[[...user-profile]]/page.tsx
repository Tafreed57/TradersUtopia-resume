'use client';

import { UserProfile } from '@clerk/nextjs';
import { ArrowLeft, User, Shield, Settings, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function UserProfilePage() {
  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black'>
      {/* Background Effects */}
      <div className='absolute inset-0 pointer-events-none overflow-hidden'>
        <div className='absolute -top-40 -right-40 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl animate-pulse'></div>
        <div className='absolute top-60 -left-40 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000'></div>
        <div className='absolute bottom-40 right-20 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl animate-pulse delay-2000'></div>
      </div>

      <div className='relative z-10 max-w-6xl mx-auto px-4 py-8'>
        {/* Professional Header */}
        <div className='mb-8'>
          <div className='flex items-center gap-4 mb-6'>
            <div className='w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-xl'>
              <User className='w-6 h-6 text-white' />
            </div>
            <div>
              <h1 className='text-3xl md:text-4xl font-bold text-white mb-2'>
                Profile Management
              </h1>
              <p className='text-gray-400 text-lg'>
                Manage your account settings, security options, and personal
                information
              </p>
            </div>
          </div>

          {/* Navigation Actions */}
          <div className='flex flex-col sm:flex-row gap-3'>
            <Button
              onClick={() => window.history.back()}
              variant='outline'
              className='bg-gray-800/50 border-gray-600 text-white hover:bg-gray-700 hover:border-gray-500'
            >
              <ArrowLeft className='w-4 h-4 mr-2' />
              Back to Dashboard
            </Button>

            <Button
              onClick={() => window.open('/user/password', '_blank')}
              className='bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white'
            >
              <Shield className='w-4 h-4 mr-2' />
              Password Management
            </Button>
          </div>
        </div>

        {/* Professional Profile Card */}
        <Card className='bg-gradient-to-br from-gray-800/90 via-gray-800/70 to-gray-900/90 backdrop-blur-xl border border-gray-600/30 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:border-blue-400/50 hover:shadow-blue-400/10 rounded-2xl relative overflow-hidden'>
          {/* Card Background Effect */}
          <div className='absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-full blur-3xl'></div>

          <CardHeader className='relative z-10 pb-4'>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center'>
                <Settings className='w-5 h-5 text-white' />
              </div>
              <CardTitle className='text-white text-xl'>
                Account Settings
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent className='relative z-10 p-0'>
            {/* Professional Clerk Profile Wrapper */}
            <div className='bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-2xl m-6 border border-gray-600/20 overflow-hidden'>
              <UserProfile
                appearance={{
                  elements: {
                    rootBox: 'w-full',
                    card: 'shadow-none border-0 bg-transparent',
                    navbar: 'hidden',
                    navbarMobileMenuButton: 'hidden',
                    headerTitle: 'text-xl font-semibold text-white',
                    headerSubtitle: 'text-gray-400',
                    formButtonPrimary:
                      'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium transition-all duration-200',
                    formFieldInput:
                      'bg-gray-800/50 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/20',
                    formFieldLabel: 'text-gray-300 font-medium',
                    identityPreviewText: 'text-gray-300',
                    identityPreviewEditButton:
                      'text-blue-400 hover:text-blue-300',
                    profileSectionTitle: 'text-white font-semibold',
                    profileSectionContent: 'text-gray-300',
                    accordionTriggerButton:
                      'text-white hover:text-blue-400 transition-colors',
                    accordionContent: 'bg-gray-800/20 border-gray-600/30',
                    badge: 'bg-blue-600/20 text-blue-400 border-blue-400/30',
                    menuButton:
                      'text-gray-300 hover:text-white hover:bg-gray-700/50 transition-all duration-200',
                    menuList:
                      'bg-gray-800/95 border-gray-600/50 backdrop-blur-xl',
                    menuItem:
                      'text-gray-300 hover:text-white hover:bg-gray-700/50 transition-all duration-200',
                    dividerLine: 'bg-gray-600/30',
                    alert: 'bg-amber-600/10 border-amber-400/30 text-amber-300',
                    alertText: 'text-amber-300',
                    fileDropAreaBox:
                      'border-gray-600 bg-gray-800/30 hover:bg-gray-800/50 transition-all duration-200',
                    fileDropAreaButtonPrimary:
                      'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white',
                    avatarBox: 'border-4 border-gray-600/50 shadow-xl',
                    avatarImageActions: 'bg-gray-800/90 backdrop-blur-sm',
                    avatarImageActionsUpload:
                      'text-blue-400 hover:text-blue-300',
                    avatarImageActionsRemove: 'text-red-400 hover:text-red-300',
                  },
                  variables: {
                    colorPrimary: '#3b82f6',
                    colorText: '#ffffff',
                    colorTextSecondary: '#9ca3af',
                    colorBackground: 'transparent',
                    colorInputBackground: 'rgba(31, 41, 55, 0.5)',
                    colorInputText: '#ffffff',
                    borderRadius: '0.75rem',
                  },
                }}
                routing='path'
                path='/user-profile'
              />
            </div>
          </CardContent>
        </Card>

        {/* Additional Quick Actions */}
        <div className='mt-8 grid grid-cols-1 md:grid-cols-2 gap-6'>
          {/* Security Card */}
          <Card className='bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-400/30 rounded-2xl p-6 hover:border-red-400/50 transition-all duration-300'>
            <div className='flex items-center gap-4 mb-4'>
              <div className='w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center'>
                <Shield className='w-6 h-6 text-red-400' />
              </div>
              <div>
                <h3 className='text-white font-semibold text-lg'>
                  Security Settings
                </h3>
                <p className='text-gray-400 text-sm'>
                  Two-factor authentication and security options
                </p>
              </div>
            </div>
            <Button
              onClick={() => window.open('/user/password', '_blank')}
              className='w-full bg-red-600 hover:bg-red-700 text-white'
            >
              <ExternalLink className='w-4 h-4 mr-2' />
              Manage Security
            </Button>
          </Card>

          {/* Dashboard Card */}
          <Card className='bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-400/30 rounded-2xl p-6 hover:border-blue-400/50 transition-all duration-300'>
            <div className='flex items-center gap-4 mb-4'>
              <div className='w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center'>
                <Settings className='w-6 h-6 text-blue-400' />
              </div>
              <div>
                <h3 className='text-white font-semibold text-lg'>
                  Dashboard Settings
                </h3>
                <p className='text-gray-400 text-sm'>
                  Notifications, subscription, and preferences
                </p>
              </div>
            </div>
            <Button
              onClick={() => (window.location.href = '/dashboard')}
              className='w-full bg-blue-600 hover:bg-blue-700 text-white'
            >
              <ArrowLeft className='w-4 h-4 mr-2' />
              Back to Dashboard
            </Button>
          </Card>
        </div>

        {/* Footer */}
        <div className='mt-8 text-center'>
          <p className='text-gray-500 text-sm'>
            Your account is secured and managed by TradersUtopia
          </p>
        </div>
      </div>
    </div>
  );
}
