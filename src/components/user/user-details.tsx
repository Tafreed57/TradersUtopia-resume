'use client';

import { useUser } from '@clerk/nextjs';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Mail,
  Calendar,
  Shield,
  Activity,
  Settings,
  ExternalLink,
} from 'lucide-react';

function ProfileRow({
  icon: Icon,
  label,
  value,
  badge,
}: {
  icon: any;
  label: string;
  value: string;
  badge?: string;
}) {
  return (
    <div className='flex items-center justify-between py-3 px-4 hover:bg-gray-700/30 rounded-lg transition-colors'>
      <div className='flex items-center gap-3'>
        <div className='w-8 h-8 bg-gray-700/50 rounded-lg flex items-center justify-center'>
          <Icon className='h-4 w-4 text-gray-300' />
        </div>
        <div>
          <p className='text-sm font-medium text-white'>{label}</p>
          <p className='text-xs text-gray-400'>{value}</p>
        </div>
      </div>
      {badge && (
        <Badge
          variant='secondary'
          className='bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
        >
          {badge}
        </Badge>
      )}
    </div>
  );
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function UserDetails() {
  const { user } = useUser();

  if (!user) {
    return (
      <div className='flex items-center justify-center p-8'>
        <div className='text-center'>
          <User className='h-12 w-12 text-gray-400 mx-auto mb-4' />
          <p className='text-gray-400'>Loading profile...</p>
        </div>
      </div>
    );
  }

  // Function to navigate to Security tab
  const handleSecuritySettings = () => {
    // Find the Security tab button and click it
    const securityTab = document.querySelector(
      '[value="security"]'
    ) as HTMLButtonElement;
    if (securityTab) {
      securityTab.click();
    }
  };

  return (
    <div className='space-y-6'>
      {/* Profile Header */}
      <Card className='bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-gray-600/30 backdrop-blur-md'>
        <CardContent className='p-6'>
          <div className='flex items-center gap-6'>
            <div className='relative'>
              <Image
                src={user.imageUrl}
                alt={`${user.firstName} ${user.lastName} profile picture`}
                width={80}
                height={80}
                className='w-20 h-20 rounded-full border-3 border-yellow-400/50 shadow-lg'
              />
              <div className='absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-gray-800 flex items-center justify-center'>
                <Activity className='h-3 w-3 text-white' />
              </div>
            </div>
            <div className='flex-1'>
              <h2 className='text-2xl font-bold text-white mb-1'>
                {user.firstName} {user.lastName}
              </h2>
              <p className='text-gray-300 mb-3'>
                {user.emailAddresses[0]?.emailAddress}
              </p>
              <div className='flex items-center gap-2'>
                <Badge
                  variant='secondary'
                  className='bg-green-500/20 text-green-300 border-green-500/30'
                >
                  Active Account
                </Badge>
                <Badge
                  variant='secondary'
                  className='bg-blue-500/20 text-blue-300 border-blue-500/30'
                >
                  Premium Member
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Information */}
      <Card className='bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-gray-600/30 backdrop-blur-md'>
        <CardHeader>
          <CardTitle className='flex items-center gap-3 text-white'>
            <User className='h-5 w-5' />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-2'>
          <ProfileRow
            icon={Mail}
            label='Email Address'
            value={user.emailAddresses[0]?.emailAddress || 'Not available'}
            badge='Read-only'
          />
          <ProfileRow
            icon={Calendar}
            label='Member Since'
            value={formatDate(user.createdAt!)}
          />
          <ProfileRow
            icon={Activity}
            label='Last Sign In'
            value={formatDate(user.lastSignInAt!)}
          />
          <ProfileRow
            icon={Shield}
            label='Account Security'
            value='Secured with OAuth'
            badge='Protected'
          />
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className='bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-gray-600/30 backdrop-blur-md'>
        <CardHeader>
          <CardTitle className='flex items-center gap-3 text-white'>
            <Settings className='h-5 w-5' />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 gap-3'>
            <button
              onClick={handleSecuritySettings}
              className='p-4 rounded-lg bg-green-500/20 border border-green-500/30 hover:bg-green-500/30 transition-colors text-left group'
            >
              <div className='flex items-center justify-between mb-2'>
                <Shield className='h-5 w-5 text-green-400 group-hover:scale-110 transition-transform' />
                <div className='w-2 h-2 bg-green-400 rounded-full animate-pulse' />
              </div>
              <p className='text-sm font-medium text-white'>
                Security Settings
              </p>
              <p className='text-xs text-gray-400'>Manage account security</p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Additional Actions */}
      <Card className='bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-gray-600/30 backdrop-blur-md'>
        <CardHeader>
          <CardTitle className='flex items-center gap-3 text-white'>
            <Activity className='h-5 w-5' />
            Profile Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            <button
              onClick={() => window.open('/user-profile', '_blank')}
              className='w-full p-3 rounded-lg bg-purple-500/20 border border-purple-500/30 hover:bg-purple-500/30 transition-colors text-left group flex items-center justify-between'
            >
              <div className='flex items-center gap-3'>
                <User className='h-4 w-4 text-purple-400' />
                <div>
                  <p className='text-sm font-medium text-white'>
                    Full Profile Settings
                  </p>
                  <p className='text-xs text-gray-400'>
                    Access complete Clerk profile
                  </p>
                </div>
              </div>
              <ExternalLink className='h-4 w-4 text-purple-400/60' />
            </button>

            <button
              onClick={handleSecuritySettings}
              className='w-full p-3 rounded-lg bg-yellow-500/20 border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors text-left group flex items-center justify-between'
            >
              <div className='flex items-center gap-3'>
                <Shield className='h-4 w-4 text-yellow-400' />
                <div>
                  <p className='text-sm font-medium text-white'>
                    Password & Security
                  </p>
                  <p className='text-xs text-gray-400'>
                    Update password and 2FA settings
                  </p>
                </div>
              </div>
              <div className='w-2 h-2 bg-yellow-400 rounded-full' />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
