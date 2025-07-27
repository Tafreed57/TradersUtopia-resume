'use client';

import { useEffect, useState } from 'react';
import { UserButton } from '@clerk/nextjs';
import { useExtendedUser } from '@/hooks/use-extended-user';
import {
  Loader2,
  Crown,
  AlertTriangle,
  Zap,
  Settings,
  Bell,
  BarChart3,
  User,
  CreditCard,
  Shield,
  CheckCircle,
  Clock,
  Home,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SmartEntryButton } from '@/components/smart-entry-button';
import { SubscriptionManager } from '@/components/subscription/subscription-manager';
import { NotificationSettings } from '@/components/notifications/notification-settings';
import { NotificationBell } from '@/components/notifications/notification-bell';
import UserManagement from '@/components/admin/user-management';
import { TRADING_ALERT_PRODUCTS } from '@/lib/product-config';

// Allowed product IDs for access control
const allowedProductIds = [...TRADING_ALERT_PRODUCTS];

// Professional card styling
const cardClasses = `
  bg-gradient-to-br from-gray-800/90 via-gray-800/70 to-gray-900/90 
  backdrop-blur-xl border border-gray-600/30 shadow-2xl 
  hover:shadow-3xl transition-all duration-500 
  hover:border-blue-400/50 hover:shadow-blue-400/10
  rounded-2xl relative overflow-hidden
`;

const statCardClasses = `
  bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 
  backdrop-blur-md border border-gray-600/30 shadow-xl
  hover:shadow-2xl transition-all duration-300
  hover:border-purple-400/40 hover:shadow-purple-400/5
  rounded-xl relative overflow-hidden group
`;

export default function Dashboard() {
  // ✅ EXTENDED: Use new extended user hook that includes all service data
  const {
    user,
    isLoaded,
    hasAccess,
    subscriptionData,
    profile,
    dataSource,
    isLoading: authLoading,
  } = useExtendedUser({ enableLogging: true });

  const [servers, setServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('account');

  // Check for tab parameter in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tab = urlParams.get('tab');
      if (tab === 'settings' || tab === 'notifications') {
        setActiveTab('notifications');
      } else if (tab === 'subscription') {
        setActiveTab('subscription');
      }
    }
  }, []);

  useEffect(() => {
    const fetchServersData = async () => {
      try {
        // ✅ SIMPLIFIED: Payment verification now handled by useExtendedUser hook
        const serversResponse = await fetch('/api/servers');
        if (serversResponse.ok) {
          const serversData = await serversResponse.json();
          setServers(serversData || []);
        }
      } catch (error) {
        console.error('Error fetching servers data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isLoaded && user && !authLoading) {
      fetchServersData();
    }
  }, [isLoaded, user, authLoading]);

  if (!isLoaded || loading || authLoading) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black flex items-center justify-center'>
        <div className='text-center'>
          <div className='w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl'>
            <Loader2 className='w-8 h-8 animate-spin text-white' />
          </div>
          <h3 className='text-xl font-bold text-white mb-2'>
            Loading dashboard...
          </h3>
          <p className='text-gray-400'>Preparing your trading workspace</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black flex items-center justify-center'>
        <Card className={cardClasses}>
          <CardContent className='p-8 text-center'>
            <AlertTriangle className='w-12 h-12 text-amber-400 mx-auto mb-4' />
            <h3 className='text-xl font-bold text-white mb-2'>
              Profile Loading Error
            </h3>
            <p className='text-gray-400'>
              Unable to load your profile data. Please refresh the page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusConfig = () => {
    if (profile?.isAdmin) {
      return {
        status: 'Admin Access',
        color: 'from-red-500 to-red-600',
        textColor: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-400/30',
        icon: Crown,
        description: 'Full administrative privileges',
      };
    }

    if (hasAccess && subscriptionData) {
      return {
        status: 'Premium Active',
        color: 'from-green-500 to-emerald-600',
        textColor: 'text-green-400',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-400/30',
        icon: CheckCircle,
        description: `Valid until ${new Date(subscriptionData.subscriptionEnd || '').toLocaleDateString()}`,
      };
    }

    return {
      status: 'Free Access',
      color: 'from-gray-500 to-gray-600',
      textColor: 'text-gray-400',
      bgColor: 'bg-gray-500/10',
      borderColor: 'border-gray-400/30',
      icon: Clock,
      description: 'Limited access to platform features',
    };
  };

  const statusConfig = getStatusConfig();

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black'>
      {/* Background Effects */}
      <div className='absolute inset-0 pointer-events-none overflow-hidden'>
        <div className='absolute -top-40 -right-40 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl animate-pulse'></div>
        <div className='absolute top-60 -left-40 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000'></div>
        <div className='absolute bottom-40 right-20 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl animate-pulse delay-2000'></div>
      </div>

      <div className='container mx-auto px-4 py-6 max-w-7xl relative z-10'>
        {/* Premium Professional Header */}
        <div className='mb-8'>
          <div className='bg-gradient-to-r from-gray-800/90 via-gray-800/70 to-gray-900/90 backdrop-blur-xl border border-gray-600/30 rounded-2xl p-6 shadow-2xl'>
            <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
              {/* Left: Welcome Section */}
              <div className='flex items-center gap-4'>
                <div className='w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-xl'>
                  <Zap className='w-7 h-7 text-white' />
                </div>
                <div>
                  <h1 className='text-2xl md:text-3xl font-bold text-white flex items-center gap-2'>
                    <Crown className='w-6 h-6 text-yellow-400' />
                    Welcome back,{' '}
                    <span className='text-blue-400'>
                      {user?.firstName || 'Trader'}
                    </span>
                    !
                  </h1>
                  <p className='text-gray-400 text-sm mt-1'>
                    {profile.email} • Trading Dashboard
                  </p>
                </div>
              </div>

              {/* Right: Navigation & Status */}
              <div className='flex items-center gap-3'>
                {/* Home Button */}
                <Button
                  onClick={() => (window.location.href = '/')}
                  variant='outline'
                  size='sm'
                  className='bg-gray-700/50 hover:bg-gray-600/50 border-gray-600/50 hover:border-gray-500/50 text-gray-300 hover:text-white transition-all duration-200'
                >
                  <Home className='w-4 h-4 mr-2' />
                  Home
                </Button>

                <Badge
                  className={`${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor} border px-4 py-2 text-sm font-medium`}
                >
                  <statusConfig.icon className='w-4 h-4 mr-2' />
                  {statusConfig.status}
                </Badge>
                {hasAccess && (
                  <div className='hidden md:flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-400/30 rounded-lg'>
                    <div className='w-2 h-2 bg-green-400 rounded-full animate-pulse'></div>
                    <span className='text-xs text-green-400 font-medium'>
                      Active
                    </span>
                  </div>
                )}

                {/* Notification Bell */}
                <NotificationBell />

                {/* Clerk User Profile Button */}
                <div className='flex items-center'>
                  <UserButton
                    appearance={{
                      elements: {
                        avatarBox:
                          'w-10 h-10 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-200',
                        userButtonPopoverCard:
                          'bg-gray-800 border border-gray-600 shadow-2xl',
                        userButtonPopoverActionButton:
                          'text-gray-300 hover:bg-gray-700 hover:text-white',
                        userButtonPopoverActionButtonText: 'text-gray-300',
                        userButtonPopoverFooter: 'hidden',
                      },
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Professional Stats Grid */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-8'>
          {/* Access Status Card */}
          <Card className={statCardClasses}>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-full blur-xl'></div>
            <CardContent className='p-6 relative z-10'>
              <div className='flex items-center justify-between mb-4'>
                <div
                  className={`w-12 h-12 bg-gradient-to-br ${statusConfig.color} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}
                >
                  <statusConfig.icon className='w-6 h-6 text-white' />
                </div>
                <Badge
                  className={`${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor} border`}
                >
                  {statusConfig.status}
                </Badge>
              </div>
              <h3 className='font-bold text-white text-lg mb-1'>
                Access Status
              </h3>
              <p className='text-gray-400 text-sm'>
                {statusConfig.description}
              </p>
            </CardContent>
          </Card>

          {/* Servers Available */}
          <Card className={statCardClasses}>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-500/10 to-transparent rounded-full blur-xl'></div>
            <CardContent className='p-6 relative z-10'>
              <div className='flex items-center justify-between mb-4'>
                <div className='w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300'>
                  <Shield className='w-6 h-6 text-white' />
                </div>
                <span className='text-2xl font-bold text-purple-400'>
                  {servers.length}
                </span>
              </div>
              <h3 className='font-bold text-white text-lg mb-1'>
                Servers Available
              </h3>
              <p className='text-gray-400 text-sm'>
                Active trading communities
              </p>
            </CardContent>
          </Card>

          {/* Admin Status or Premium Features */}
          <Card className={statCardClasses}>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-full blur-xl'></div>
            <CardContent className='p-6 relative z-10'>
              <div className='flex items-center justify-between mb-4'>
                <div className='w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300'>
                  {profile.isAdmin ? (
                    <Crown className='w-6 h-6 text-white' />
                  ) : (
                    <Settings className='w-6 h-6 text-white' />
                  )}
                </div>
                <Badge
                  className={
                    profile.isAdmin
                      ? 'bg-red-500/10 text-red-400 border-red-400/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-400/30'
                  }
                >
                  {profile.isAdmin ? 'Admin' : 'User'}
                </Badge>
              </div>
              <h3 className='font-bold text-white text-lg mb-1'>
                Account Type
              </h3>
              <p className='text-gray-400 text-sm'>
                {profile.isAdmin
                  ? 'Administrative access enabled'
                  : 'Standard user privileges'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Content - Accessible to All Users */}
        <div className='space-y-8'>
          {/* Professional Trading Tools */}
          <Card className={cardClasses}>
            <div className='absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-full blur-2xl'></div>
            <CardHeader className='relative z-10'>
              <div className='flex items-center gap-4'>
                <div className='w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg'>
                  <Zap className='w-6 h-6 text-white' />
                </div>
                <div>
                  <CardTitle className='text-white text-xl'>
                    Trading Tools
                  </CardTitle>
                  <CardDescription className='text-gray-400'>
                    Professional trading resources and performance analysis
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className='space-y-6 relative z-10'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                {/* Trading Signals */}
                <div className='group relative'>
                  <div className='absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-300'></div>
                  <div className='relative p-6 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-purple-500/10 border border-blue-400/30 rounded-2xl hover:border-blue-400/50 transition-all duration-300'>
                    <div className='flex items-center gap-3 mb-4'>
                      <div className='w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center'>
                        <Zap className='w-5 h-5 text-blue-400' />
                      </div>
                      <div>
                        <h3 className='text-white font-semibold text-lg'>
                          Trading Signals
                        </h3>
                        <p className='text-blue-300 text-sm'>
                          Live market analysis & signals
                        </p>
                      </div>
                    </div>
                    <p className='text-gray-300 text-sm mb-4'>
                      Access real-time trading signals, market analysis, and
                      connect with our trading community.
                    </p>
                    <SmartEntryButton
                      className='w-full'
                      customProductIds={allowedProductIds}
                    />
                  </div>
                </div>

                {/* Track Record */}
                <div className='group relative'>
                  <div className='absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-300'></div>
                  <div className='relative p-6 bg-gradient-to-br from-green-500/10 via-green-500/5 to-emerald-500/10 border border-green-400/30 rounded-2xl hover:border-green-400/50 transition-all duration-300'>
                    <div className='flex items-center gap-3 mb-4'>
                      <div className='w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center'>
                        <BarChart3 className='w-5 h-5 text-green-400' />
                      </div>
                      <div>
                        <h3 className='text-white font-semibold text-lg'>
                          Track Record
                        </h3>
                        <p className='text-green-300 text-sm'>
                          Verified performance data
                        </p>
                      </div>
                    </div>
                    <p className='text-gray-300 text-sm mb-4'>
                      View our comprehensive trading track record with verified
                      results and transparent performance metrics.
                    </p>
                    <Button
                      onClick={() => (window.location.href = '/track-record')}
                      className='w-full bg-green-600 hover:bg-green-700 text-white font-medium'
                    >
                      <BarChart3 className='w-4 h-4 mr-2' />
                      View Track Record
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Professional Settings Tabs */}
          <Card className={cardClasses}>
            <div className='absolute top-0 left-0 w-40 h-40 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-3xl'></div>
            <CardHeader className='relative z-10'>
              <div className='flex items-center gap-3'>
                <div className='w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center'>
                  <Settings className='w-5 h-5 text-white' />
                </div>
                <div>
                  <CardTitle className='text-white text-xl'>
                    Account Management
                  </CardTitle>
                  <CardDescription className='text-gray-400'>
                    Manage your account, notifications, and subscription
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className='relative z-10'>
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className='w-full'
              >
                <TabsList
                  className={`grid w-full ${profile?.isAdmin ? 'grid-cols-4' : 'grid-cols-3'} bg-gray-700/50 p-2 gap-1 rounded-xl min-h-[60px]`}
                >
                  <TabsTrigger
                    value='account'
                    className='data-[state=active]:bg-blue-600 data-[state=active]:shadow-lg rounded-lg transition-all duration-200 px-3 py-2 text-sm font-medium'
                  >
                    <User className='w-4 h-4 mr-2 flex-shrink-0' />
                    <span className='truncate'>Account</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value='notifications'
                    className='data-[state=active]:bg-amber-600 data-[state=active]:shadow-lg rounded-lg transition-all duration-200 px-3 py-2 text-sm font-medium'
                  >
                    <Bell className='w-4 h-4 mr-2 flex-shrink-0' />
                    <span className='truncate'>Notifications</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value='subscription'
                    className='data-[state=active]:bg-green-600 data-[state=active]:shadow-lg rounded-lg transition-all duration-200 px-3 py-2 text-sm font-medium'
                  >
                    <CreditCard className='w-4 h-4 mr-2 flex-shrink-0' />
                    <span className='truncate'>Subscription</span>
                  </TabsTrigger>
                  {/* ⚡ ADMIN-ONLY TAB: Only visible to admin users */}
                  {profile?.isAdmin && (
                    <TabsTrigger
                      value='admin'
                      className='data-[state=active]:bg-red-600 data-[state=active]:shadow-lg rounded-lg transition-all duration-200 px-3 py-2 text-sm font-medium'
                    >
                      <Crown className='w-4 h-4 mr-2 flex-shrink-0' />
                      <span className='truncate'>Admin Panel</span>
                    </TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value='account' className='mt-6'>
                  <div className='space-y-6'>
                    <div className='p-6 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-400/30 rounded-2xl'>
                      <div className='flex items-center gap-4 mb-4'>
                        <div className='w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center'>
                          <User className='w-6 h-6 text-blue-400' />
                        </div>
                        <div>
                          <h4 className='text-white font-semibold text-lg'>
                            Profile Information
                          </h4>
                          <p className='text-gray-300 text-sm'>
                            Manage your profile details and security settings
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => (window.location.href = '/user-profile')}
                        className='bg-blue-600 hover:bg-blue-700'
                      >
                        <User className='w-4 h-4 mr-2' />
                        Manage Profile
                      </Button>
                    </div>

                    <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                      <div className='p-6 bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-2xl border border-gray-600/30'>
                        <div className='flex items-center gap-3 mb-3'>
                          <CheckCircle className='w-5 h-5 text-green-400' />
                          <h5 className='text-white font-medium'>
                            Account Status
                          </h5>
                        </div>
                        <p className='text-gray-300 text-sm mb-2'>
                          {hasAccess ? 'Premium Member' : 'Free Account'}
                        </p>
                        <p className='text-gray-400 text-xs'>
                          Member since:{' '}
                          {new Date(
                            profile.createdAt || ''
                          ).toLocaleDateString()}
                        </p>
                      </div>

                      <div className='p-6 bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-2xl border border-gray-600/30'>
                        <div className='flex items-center gap-3 mb-3'>
                          <Shield className='w-5 h-5 text-purple-400' />
                          <h5 className='text-white font-medium'>Security</h5>
                        </div>
                        <p className='text-gray-300 text-sm mb-2'>
                          {profile.isAdmin
                            ? 'Admin Account'
                            : 'Standard Security'}
                        </p>
                        <p className='text-gray-400 text-xs'>
                          Two-factor authentication available
                        </p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value='notifications' className='mt-6'>
                  <NotificationSettings />
                </TabsContent>

                <TabsContent value='subscription' className='mt-6'>
                  <SubscriptionManager />
                </TabsContent>

                {/* ⚡ ADMIN-ONLY PANEL: Complete admin management interface */}
                {profile?.isAdmin && (
                  <TabsContent value='admin' className='mt-6'>
                    <div className='space-y-6'>
                      {/* Admin Panel Header */}
                      <div className='p-6 bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-400/30 rounded-2xl'>
                        <div className='flex items-center gap-4 mb-4'>
                          <div className='w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center'>
                            <Crown className='w-6 h-6 text-red-400' />
                          </div>
                          <div>
                            <h4 className='text-white font-semibold text-lg'>
                              🚀 Administrative Control Panel
                            </h4>
                            <p className='text-gray-300 text-sm'>
                              Complete platform management and user
                              administration
                            </p>
                          </div>
                        </div>

                        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                          <div className='p-4 bg-red-500/10 border border-red-400/20 rounded-xl'>
                            <div className='flex items-center gap-2 mb-2'>
                              <Users className='w-4 h-4 text-red-400' />
                              <span className='text-red-400 font-medium text-sm'>
                                User Management
                              </span>
                            </div>
                            <p className='text-gray-300 text-xs'>
                              Full user control, subscriptions, and permissions
                            </p>
                          </div>

                          <div className='p-4 bg-orange-500/10 border border-orange-400/20 rounded-xl'>
                            <div className='flex items-center gap-2 mb-2'>
                              <Settings className='w-4 h-4 text-orange-400' />
                              <span className='text-orange-400 font-medium text-sm'>
                                Server Management
                              </span>
                            </div>
                            <p className='text-gray-300 text-xs'>
                              Server synchronization and platform health
                            </p>
                          </div>

                          <div className='p-4 bg-purple-500/10 border border-purple-400/20 rounded-xl'>
                            <div className='flex items-center gap-2 mb-2'>
                              <Shield className='w-4 h-4 text-purple-400' />
                              <span className='text-purple-400 font-medium text-sm'>
                                System Controls
                              </span>
                            </div>
                            <p className='text-gray-300 text-xs'>
                              Advanced system configuration and monitoring
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Admin Tools Row */}
                      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                        {/* Server Management Card */}
                        <div className='p-6 bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-400/30 rounded-2xl'>
                          <div className='flex items-center gap-3 mb-4'>
                            <div className='w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center'>
                              <Settings className='w-5 h-5 text-orange-400' />
                            </div>
                            <div>
                              <h5 className='text-white font-semibold'>
                                Server Management
                              </h5>
                              <p className='text-gray-300 text-sm'>
                                Synchronize and manage servers
                              </p>
                            </div>
                          </div>
                          <div className='space-y-3'>
                            <Button
                              onClick={() =>
                                (window.location.href =
                                  '/api/servers/ensure-all-users')
                              }
                              className='w-full bg-orange-600 hover:bg-orange-700'
                            >
                              <Settings className='w-4 h-4 mr-2' />
                              Sync All Servers
                            </Button>
                            <div className='p-3 bg-orange-500/10 border border-orange-400/20 rounded-lg'>
                              <p className='text-orange-400 text-xs'>
                                Ensures all users are properly synced to servers
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Quick Actions Card */}
                        <div className='p-6 bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-400/30 rounded-2xl'>
                          <div className='flex items-center gap-3 mb-4'>
                            <div className='w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center'>
                              <Shield className='w-5 h-5 text-purple-400' />
                            </div>
                            <div>
                              <h5 className='text-white font-semibold'>
                                System Health
                              </h5>
                              <p className='text-gray-300 text-sm'>
                                Monitor platform status
                              </p>
                            </div>
                          </div>
                          <div className='space-y-3'>
                            <div className='flex items-center justify-between p-3 bg-green-500/10 border border-green-400/20 rounded-lg'>
                              <span className='text-green-400 text-sm font-medium'>
                                Database
                              </span>
                              <div className='flex items-center gap-2'>
                                <div className='w-2 h-2 bg-green-400 rounded-full animate-pulse'></div>
                                <span className='text-green-400 text-xs'>
                                  Online
                                </span>
                              </div>
                            </div>
                            <div className='flex items-center justify-between p-3 bg-green-500/10 border border-green-400/20 rounded-lg'>
                              <span className='text-green-400 text-sm font-medium'>
                                Webhooks
                              </span>
                              <div className='flex items-center gap-2'>
                                <div className='w-2 h-2 bg-green-400 rounded-full animate-pulse'></div>
                                <span className='text-green-400 text-xs'>
                                  Active
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* User Management Section */}
                      <div className='p-6 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-400/30 rounded-2xl'>
                        <UserManagement />
                      </div>
                    </div>
                  </TabsContent>
                )}
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
