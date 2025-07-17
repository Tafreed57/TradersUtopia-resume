'use client';

import { useEffect, useState } from 'react';
import { UserButton } from '@clerk/nextjs';
import { useUser } from '@clerk/nextjs';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { SubscriptionProtectedLink } from '@/components/subscription-protected-link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  User,
  Settings,
  Crown,
  Users,
  Activity,
  TrendingUp,
  Home,
  Bell,
  Zap,
  Lock,
  CheckCircle,
  Star,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { GlobalMobileMenu } from '@/components/global-mobile-menu';
import { UserManagement } from '@/components/admin/user-management';
import { NotificationSettings } from '@/components/notifications/notification-settings';
import { SubscriptionManager } from '@/components/subscription/subscription-manager';
import { PasswordManager } from '@/components/user/password-manager';
import { UserDetails } from '@/components/user/user-details';
import { TRADING_ALERT_PRODUCTS } from '@/lib/product-config';

// Move allowedProductIds outside component to avoid dependency issues
const allowedProductIds = [...TRADING_ALERT_PRODUCTS];

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  const [profile, setProfile] = useState<any>(null);
  const [servers, setServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Smart server navigation function
  const handleServerNavigation = async () => {
    try {
      const response = await fetch('/api/servers/ensure-default', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.server?.id) {
          window.location.href = `/servers/${data.server.id}`;
          return;
        }
      }
    } catch (error) {
      console.error('Error getting default server:', error);
    }

    // Fallback to dashboard if server navigation fails
    window.location.href = '/dashboard';
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch profile data
        const profileResponse = await fetch('/api/user/profile');
        const profileData = await profileResponse.json();
        setProfile(profileData);

        // Check subscription access
        const accessResponse = await fetch('/api/check-product-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            allowedProductIds,
          }),
        });
        const accessData = await accessResponse.json();
        setHasAccess(accessData.hasAccess || false);

        // Fetch servers data
        const serversResponse = await fetch('/api/servers');
        if (serversResponse.ok) {
          const serversData = await serversResponse.json();
          setServers(serversData || []);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isLoaded && user) {
      fetchData();
    }
  }, [isLoaded, user]);

  if (!isLoaded || loading) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black flex items-center justify-center'>
        <div className='text-center'>
          <Loader2 className='w-8 h-8 animate-spin mx-auto mb-4 text-blue-400' />
          <p className='text-gray-300'>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black flex items-center justify-center'>
        <div className='text-center'>
          <p className='text-gray-300'>Unable to load profile data</p>
        </div>
      </div>
    );
  }

  // Check if user has active subscription - prioritize actual access check
  const hasActiveSubscription =
    hasAccess ||
    (profile.subscriptionStatus === 'ACTIVE' &&
      profile.subscriptionEnd &&
      new Date(profile.subscriptionEnd) > new Date());

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white relative'>
      {/* Animated Background Effects */}
      <div className='absolute inset-0 pointer-events-none overflow-hidden'>
        <div className='absolute -top-40 -right-40 w-80 h-80 bg-blue-500/8 rounded-full blur-3xl animate-pulse'></div>
        <div className='absolute top-60 -left-40 w-96 h-96 bg-purple-500/6 rounded-full blur-3xl animate-pulse delay-1000'></div>
        <div className='absolute bottom-40 right-20 w-64 h-64 bg-yellow-500/8 rounded-full blur-3xl animate-pulse delay-2000'></div>
        <div className='absolute top-20 left-1/2 w-72 h-72 bg-green-500/5 rounded-full blur-3xl animate-pulse delay-3000'></div>
      </div>

      {/* Modern Header */}
      <header className='relative z-10 border-b border-gray-800/50 bg-gray-900/30'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between items-center h-16'>
            {/* Logo Section */}
            <Link href='/' className='flex items-center space-x-3'>
              <div className='w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center'>
                <Image
                  src='/logo.png'
                  alt='TradersUtopia'
                  width={20}
                  height={20}
                  className='w-5 h-5'
                />
              </div>
              <span className='text-xl font-bold text-white'>
                TradersUtopia
              </span>
              {profile.isAdmin && (
                <Badge
                  variant='destructive'
                  className='ml-2 bg-red-600/20 text-red-400 border border-red-500/30'
                >
                  <Shield className='w-3 h-3 mr-1' />
                  Admin
                </Badge>
              )}
            </Link>

            {/* Right Section */}
            <div className='flex items-center space-x-4'>
              <NotificationBell />
              <UserButton />
              <GlobalMobileMenu currentPage='dashboard' />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className='relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {/* Welcome Section */}
        <div className='mb-8'>
          <h1 className='text-3xl font-bold text-white mb-2'>
            Welcome back, {profile.name || user?.firstName || 'User'}! 👋
          </h1>
          <p className='text-lg text-gray-400'>
            {hasActiveSubscription
              ? 'Manage your premium trading account and access all features'
              : 'Get started with trading insights and upgrade to access premium features'}
          </p>
        </div>

        {/* Status Cards Row */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-8'>
          {/* Account Status */}
          <Card className='bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-gray-700/50'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-3'>
              <CardTitle className='text-sm font-medium text-gray-300'>
                Account Status
              </CardTitle>
              <div
                className={`w-3 h-3 rounded-full ${hasActiveSubscription ? 'bg-green-500' : 'bg-yellow-500'}`}
              />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold text-white mb-1'>
                {hasActiveSubscription ? 'Active' : 'Free'}
              </div>
              <p className='text-sm text-gray-400'>
                {hasActiveSubscription
                  ? profile.subscriptionEnd
                    ? `Expires ${new Date(profile.subscriptionEnd).toLocaleDateString()}`
                    : 'Premium access active'
                  : 'Upgrade to unlock all features'}
              </p>
            </CardContent>
          </Card>

          {/* Trading Servers */}
          <Card className='bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-gray-700/50'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-3'>
              <CardTitle className='text-sm font-medium text-gray-300'>
                Trading Servers
              </CardTitle>
              <Users className='w-4 h-4 text-gray-400' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold text-white mb-1'>
                {servers.length}
              </div>
              <p className='text-sm text-gray-400'>Available servers</p>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className='bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-gray-700/50'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-3'>
              <CardTitle className='text-sm font-medium text-gray-300'>
                Your Role
              </CardTitle>
              <Star className='w-4 h-4 text-gray-400' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold text-white mb-1'>
                {profile.isAdmin ? 'Admin' : 'Member'}
              </div>
              <p className='text-sm text-gray-400'>
                {profile.isAdmin ? 'Full system access' : 'Standard access'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions Grid */}
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-8'>
          {/* Premium Trading Servers */}
          <div className='relative'>
            <Card
              className='h-full hover:shadow-lg transition-all duration-200 cursor-pointer relative overflow-hidden group bg-gradient-to-br from-blue-600/20 to-blue-700/20 border border-blue-500/30 hover:from-blue-600/30 hover:to-blue-700/30 hover:border-blue-400/50'
              onClick={
                hasActiveSubscription
                  ? handleServerNavigation
                  : () => (window.location.href = '/pricing')
              }
            >
              {!hasActiveSubscription && (
                <div className='absolute top-2 right-2 z-10'>
                  <Badge
                    variant='secondary'
                    className='text-xs bg-gray-600/20 text-gray-400 border border-gray-500/30'
                  >
                    <Crown className='w-3 h-3 mr-1' />
                    Premium
                  </Badge>
                </div>
              )}
              <CardContent className='p-6 text-center'>
                <div
                  className={`w-12 h-12 rounded-lg mx-auto mb-4 flex items-center justify-center ${
                    hasActiveSubscription
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-gray-600/20 text-gray-400'
                  }`}
                >
                  <Users className='w-6 h-6' />
                </div>
                <h3 className='font-semibold text-white mb-2'>
                  Trading Servers
                </h3>
                <p className='text-sm text-blue-200'>
                  Join live trading discussions
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Track Record - Free */}
          <Link href='/track-record'>
            <Card className='h-full hover:shadow-lg transition-all duration-200 cursor-pointer bg-gradient-to-br from-green-600/20 to-green-700/20 border border-green-500/30 hover:from-green-600/30 hover:to-green-700/30 hover:border-green-400/50'>
              <CardContent className='p-6 text-center'>
                <div className='w-12 h-12 bg-green-500/20 text-green-400 rounded-lg mx-auto mb-4 flex items-center justify-center'>
                  <TrendingUp className='w-6 h-6' />
                </div>
                <h3 className='font-semibold text-white mb-2'>Track Record</h3>
                <p className='text-sm text-green-200'>
                  View trading performance
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* Billing/Upgrade */}
          {hasActiveSubscription ? (
            <Card
              className='h-full hover:shadow-lg transition-all duration-200 cursor-pointer bg-gradient-to-br from-yellow-600/20 to-yellow-700/20 border border-yellow-500/30 hover:from-yellow-600/30 hover:to-yellow-700/30 hover:border-yellow-400/50'
              onClick={() => {
                // Switch to subscription tab
                setActiveTab('subscription');
              }}
            >
              <CardContent className='p-6 text-center'>
                <div className='w-12 h-12 bg-yellow-500/20 text-yellow-400 rounded-lg mx-auto mb-4 flex items-center justify-center'>
                  <Crown className='w-6 h-6' />
                </div>
                <h3 className='font-semibold text-white mb-2'>Billing</h3>
                <p className='text-sm text-yellow-200'>Manage subscription</p>
              </CardContent>
            </Card>
          ) : (
            <Link href='/pricing'>
              <Card className='h-full hover:shadow-lg transition-all duration-200 cursor-pointer bg-gradient-to-br from-yellow-600/20 to-yellow-700/20 border border-yellow-500/30 hover:from-yellow-600/30 hover:to-yellow-700/30 hover:border-yellow-400/50'>
                <CardContent className='p-6 text-center'>
                  <div className='w-12 h-12 bg-yellow-500/20 text-yellow-400 rounded-lg mx-auto mb-4 flex items-center justify-center'>
                    <Crown className='w-6 h-6' />
                  </div>
                  <h3 className='font-semibold text-white mb-2'>Upgrade</h3>
                  <p className='text-sm text-yellow-200'>
                    Get premium features
                  </p>
                </CardContent>
              </Card>
            </Link>
          )}

          {/* Homepage */}
          <Link href='/'>
            <Card className='h-full hover:shadow-lg transition-all duration-200 cursor-pointer bg-gradient-to-br from-purple-600/20 to-purple-700/20 border border-purple-500/30 hover:from-purple-600/30 hover:to-purple-700/30 hover:border-purple-400/50'>
              <CardContent className='p-6 text-center'>
                <div className='w-12 h-12 bg-purple-500/20 text-purple-400 rounded-lg mx-auto mb-4 flex items-center justify-center'>
                  <Home className='w-6 h-6' />
                </div>
                <h3 className='font-semibold text-white mb-2'>Homepage</h3>
                <p className='text-sm text-purple-200'>Back to main site</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Main Dashboard Tabs */}
        <Card className='bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-gray-700/50'>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className='w-full'
          >
            <CardHeader className='pb-4'>
              <TabsList className='grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 h-auto p-1 bg-gray-800/50 border border-gray-700/50'>
                <TabsTrigger
                  value='overview'
                  className='flex items-center gap-2 data-[state=active]:bg-blue-600/50 data-[state=active]:text-white text-gray-300 hover:text-white transition-all duration-200 py-2 px-3 text-sm'
                >
                  <Activity className='w-4 h-4' />
                  <span className='hidden sm:inline'>Overview</span>
                  <span className='sm:hidden'>Home</span>
                </TabsTrigger>
                <TabsTrigger
                  value='subscription'
                  className='flex items-center gap-2 data-[state=active]:bg-blue-600/50 data-[state=active]:text-white text-gray-300 hover:text-white transition-all duration-200 py-2 px-3 text-sm'
                >
                  <Crown className='w-4 h-4' />
                  <span className='hidden sm:inline'>Subscription</span>
                  <span className='sm:hidden'>Plan</span>
                </TabsTrigger>
                <TabsTrigger
                  value='profile'
                  className='flex items-center gap-2 data-[state=active]:bg-blue-600/50 data-[state=active]:text-white text-gray-300 hover:text-white transition-all duration-200 py-2 px-3 text-sm'
                >
                  <User className='w-4 h-4' />
                  <span className='hidden sm:inline'>Profile</span>
                  <span className='sm:hidden'>User</span>
                </TabsTrigger>
                <TabsTrigger
                  value='settings'
                  className='flex items-center gap-2 data-[state=active]:bg-blue-600/50 data-[state=active]:text-white text-gray-300 hover:text-white transition-all duration-200 py-2 px-3 text-sm'
                >
                  <Settings className='w-4 h-4' />
                  <span className='hidden sm:inline'>Settings</span>
                  <span className='sm:hidden'>Config</span>
                </TabsTrigger>
                <TabsTrigger
                  value='notifications'
                  className='flex items-center gap-2 data-[state=active]:bg-blue-600/50 data-[state=active]:text-white text-gray-300 hover:text-white transition-all duration-200 py-2 px-3 text-sm'
                >
                  <Bell className='w-4 h-4' />
                  <span className='hidden sm:inline'>Notifications</span>
                  <span className='sm:hidden'>Alerts</span>
                </TabsTrigger>
                {profile.isAdmin && (
                  <TabsTrigger
                    value='admin'
                    className='flex items-center gap-2 data-[state=active]:bg-red-600/50 data-[state=active]:text-white text-gray-300 hover:text-white transition-all duration-200 py-2 px-3 text-sm'
                  >
                    <Shield className='w-4 h-4' />
                    <span className='hidden sm:inline'>Admin</span>
                    <span className='sm:hidden'>Admin</span>
                  </TabsTrigger>
                )}
              </TabsList>
            </CardHeader>

            <CardContent>
              {/* Overview Tab */}
              <TabsContent value='overview' className='space-y-6 mt-0'>
                <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
                  {/* Account Status Details */}
                  <Card className='bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-gray-700/50'>
                    <CardHeader>
                      <CardTitle className='flex items-center gap-2 text-white'>
                        <Activity className='w-5 h-5 text-blue-400' />
                        Account Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                      <div className='flex justify-between items-center py-2 border-b border-gray-700/50'>
                        <span className='font-medium text-gray-300'>
                          Status
                        </span>
                        <Badge
                          variant={
                            hasActiveSubscription ? 'default' : 'secondary'
                          }
                          className={
                            hasActiveSubscription
                              ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                              : 'bg-gray-600/20 text-gray-400 border border-gray-500/30'
                          }
                        >
                          {hasActiveSubscription ? 'ACTIVE' : 'FREE'}
                        </Badge>
                      </div>
                      <div className='flex justify-between items-center py-2 border-b border-gray-700/50'>
                        <span className='font-medium text-gray-300'>Role</span>
                        <Badge
                          variant={profile.isAdmin ? 'destructive' : 'outline'}
                          className={
                            profile.isAdmin
                              ? 'bg-red-600/20 text-red-400 border border-red-500/30'
                              : 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                          }
                        >
                          {profile.isAdmin ? 'Admin' : 'Member'}
                        </Badge>
                      </div>
                      {hasActiveSubscription && profile.subscriptionEnd && (
                        <div className='flex justify-between items-center py-2'>
                          <span className='font-medium text-gray-300'>
                            Expires
                          </span>
                          <span className='text-sm text-gray-400'>
                            {new Date(
                              profile.subscriptionEnd
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Quick Access */}
                  <Card className='bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-gray-700/50'>
                    <CardHeader>
                      <CardTitle className='flex items-center gap-2 text-white'>
                        <Zap className='w-5 h-5 text-green-400' />
                        Quick Access
                      </CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-3'>
                      <Link
                        href='/track-record'
                        className='flex items-center justify-between p-3 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 transition-colors'
                      >
                        <div className='flex items-center gap-3'>
                          <TrendingUp className='w-5 h-5 text-green-400' />
                          <span className='font-medium text-white'>
                            Track Record
                          </span>
                        </div>
                        <CheckCircle className='w-4 h-4 text-green-400' />
                      </Link>

                      <div className='flex items-center justify-between p-3 rounded-lg bg-gray-700/30'>
                        <div className='flex items-center gap-3'>
                          <Users className='w-5 h-5 text-blue-400' />
                          <span className='font-medium text-white'>
                            Trading Servers
                          </span>
                        </div>
                        {hasActiveSubscription ? (
                          <Button
                            size='sm'
                            variant='outline'
                            className='border-blue-500/30 text-blue-400 hover:bg-blue-600/20'
                            onClick={handleServerNavigation}
                          >
                            Access
                          </Button>
                        ) : (
                          <Badge
                            variant='secondary'
                            className='bg-gray-600/20 text-gray-400 border border-gray-500/30'
                          >
                            <Lock className='w-3 h-3 mr-1' />
                            Premium
                          </Badge>
                        )}
                      </div>

                      {hasActiveSubscription ? (
                        <div
                          className='flex items-center justify-between p-3 rounded-lg bg-yellow-600/20 hover:bg-yellow-600/30 transition-colors border border-yellow-500/30 cursor-pointer'
                          onClick={() => setActiveTab('subscription')}
                        >
                          <div className='flex items-center gap-3'>
                            <Crown className='w-5 h-5 text-yellow-400' />
                            <span className='font-medium text-white'>
                              Manage Billing
                            </span>
                          </div>
                          <Button
                            size='sm'
                            variant='outline'
                            className='border-yellow-500/30 text-yellow-400 hover:bg-yellow-600/20'
                          >
                            Manage
                          </Button>
                        </div>
                      ) : (
                        <Link
                          href='/pricing'
                          className='flex items-center justify-between p-3 rounded-lg bg-yellow-600/20 hover:bg-yellow-600/30 transition-colors border border-yellow-500/30'
                        >
                          <div className='flex items-center gap-3'>
                            <Crown className='w-5 h-5 text-yellow-400' />
                            <span className='font-medium text-white'>
                              Upgrade to Premium
                            </span>
                          </div>
                          <Button
                            size='sm'
                            className='bg-yellow-600 hover:bg-yellow-700 text-black font-semibold'
                          >
                            Upgrade
                          </Button>
                        </Link>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Subscription Tab - Keep existing content */}
              <TabsContent value='subscription'>
                <Card className='bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-gray-700/50'>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2 text-white'>
                      <Crown className='w-5 h-5 text-yellow-400' />
                      Subscription Management
                    </CardTitle>
                    <CardDescription className='text-gray-400'>
                      Manage your subscription and billing information
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SubscriptionManager />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Profile Tab - Keep existing content */}
              <TabsContent value='profile'>
                <Card className='bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-gray-700/50'>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2 text-white'>
                      <User className='w-5 h-5 text-blue-400' />
                      Profile Information
                    </CardTitle>
                    <CardDescription className='text-gray-400'>
                      Manage your personal information and account details
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <UserDetails />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Settings Tab - Keep existing content */}
              <TabsContent value='settings'>
                <Card className='bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-gray-700/50'>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2 text-white'>
                      <Settings className='w-5 h-5 text-blue-400' />
                      Security Settings
                    </CardTitle>
                    <CardDescription className='text-gray-400'>
                      Manage your password and security preferences
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PasswordManager />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Notifications Tab - Keep existing content */}
              <TabsContent value='notifications'>
                <Card className='bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-gray-700/50'>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2 text-white'>
                      <Bell className='w-5 h-5 text-blue-400' />
                      Notification Settings
                    </CardTitle>
                    <CardDescription className='text-gray-400'>
                      Control your notification preferences
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <NotificationSettings />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Admin Tab - Keep existing content */}
              {profile.isAdmin && (
                <TabsContent value='admin'>
                  <Card className='bg-gradient-to-br from-red-900/30 to-red-800/30 border-red-700/50'>
                    <CardHeader>
                      <CardTitle className='flex items-center gap-2 text-white'>
                        <Shield className='w-5 h-5 text-red-400' />
                        Admin Panel
                      </CardTitle>
                      <CardDescription className='text-gray-400'>
                        Administrative tools and user management
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <UserManagement />
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </CardContent>
          </Tabs>
        </Card>
      </main>
    </div>
  );
}
