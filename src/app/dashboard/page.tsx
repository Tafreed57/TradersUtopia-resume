import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import { DiscordProfile } from '@/components/user/discord-profile';
import { ModeToggle } from '@/components/mode-toggler';
import { TwoFactorAuth } from '@/components/security/two-factor-auth';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { NotificationSettings } from '@/components/notifications/notification-settings';
import { SubscriptionManager } from '@/components/subscription/subscription-manager';
import { SubscriptionProtectedLink } from '@/components/subscription-protected-link';
import { initProfile, getAllServers } from '@/lib/query';
import { redirect } from 'next/navigation';
import { ProductPaymentGate } from '@/components/product-payment-gate';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  User,
  Settings,
  MessageSquare,
  Crown,
  Users,
  Sparkles,
  Activity,
  TrendingUp,
  BarChart3,
  Home,
  Bell,
  UserCog,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AdminButton } from '@/components/admin-button';
import { GlobalMobileMenu } from '@/components/global-mobile-menu';
import { UserManagement } from '@/components/admin/user-management';

export default async function Dashboard() {
  const profile = await initProfile();
  console.log(profile);

  // Get user's servers but don't redirect - let them choose what to do
  const servers = await getAllServers(profile.id);

  // Configure which Stripe products are allowed for dashboard access
  const allowedProductIds = [
    'prod_SWIyAf2tfVrJao', // Your current product ID
    // Add more product IDs here as you create them
  ];

  return (
    <ProductPaymentGate
      allowedProductIds={allowedProductIds}
      productName='Premium Dashboard Access'
      upgradeUrl='https://buy.stripe.com/test_28E6oG8nd5Bm3N1esU4Ja01'
      features={[
        'Exclusive dashboard access',
        'Advanced server management',
        'Premium support',
        'Priority features',
      ]}
    >
      <div className='min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white relative overflow-x-hidden'>
        {/* Animated Background Effects */}
        <div className='absolute inset-0 pointer-events-none'>
          <div className='absolute -top-40 -right-40 w-80 h-80 bg-blue-500/8 rounded-full blur-3xl animate-pulse'></div>
          <div className='absolute top-60 -left-40 w-96 h-96 bg-purple-500/6 rounded-full blur-3xl animate-pulse delay-1000'></div>
          <div className='absolute bottom-40 right-20 w-64 h-64 bg-yellow-500/8 rounded-full blur-3xl animate-pulse delay-2000'></div>
          <div className='absolute top-20 left-1/2 w-72 h-72 bg-green-500/5 rounded-full blur-3xl animate-pulse delay-3000'></div>
        </div>

        <div className='relative z-10'>
          <main className='max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6'>
            {/* Enhanced Header - Mobile-Optimized */}
            <header className='w-full mb-8 sm:mb-12'>
              {/* Mobile Header */}
              <div className='flex md:hidden items-center justify-between w-full p-4 bg-gradient-to-r from-gray-800/60 via-gray-800/40 to-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-700/30 shadow-2xl'>
                <div className='flex items-center gap-3 min-w-0 flex-1'>
                  <div className='w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0'>
                    <Sparkles className='w-5 h-5 text-black' />
                  </div>
                  <div className='min-w-0 flex-1'>
                    <h1 className='text-lg font-bold bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent truncate'>
                      Dashboard
                    </h1>
                    <p className='text-gray-400 text-xs truncate'>
                      Welcome, {profile.name?.split(' ')[0]}
                    </p>
                  </div>
                </div>
                <div className='flex items-center gap-2 flex-shrink-0'>
                  <NotificationBell />
                  <UserButton
                    afterSignOutUrl='/'
                    appearance={{
                      elements: {
                        userButtonAvatarBox:
                          'size-8 border-2 border-yellow-400/50',
                      },
                    }}
                  />
                  <GlobalMobileMenu />
                </div>
              </div>

              {/* Desktop Header */}
              <div className='hidden md:flex items-center justify-between w-full h-20 gap-4 bg-gradient-to-r from-gray-800/60 via-gray-800/40 to-gray-900/60 backdrop-blur-xl rounded-2xl border border-gray-700/30 px-6 lg:px-8 shadow-2xl'>
                <div className='flex items-center gap-6 min-w-0 flex-1'>
                  <div className='flex items-center gap-4 min-w-0 flex-1'>
                    <div className='w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0'>
                      <Sparkles className='w-6 h-6 text-black' />
                    </div>
                    <div className='min-w-0 flex-1'>
                      <h1 className='text-xl lg:text-2xl font-bold bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent truncate'>
                        Trading Dashboard
                      </h1>
                      <p className='text-gray-400 text-sm truncate'>
                        Welcome back, {profile.name}
                      </p>
                    </div>
                  </div>
                  <div className='hidden lg:block flex-shrink-0'>
                    <ModeToggle />
                  </div>
                </div>
                <div className='flex items-center gap-2 lg:gap-4 flex-shrink-0'>
                  <Link href='/'>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='text-white hover:bg-gray-700/50 bg-gray-700/30 backdrop-blur-sm border border-gray-600/30 transition-all duration-300'
                    >
                      <Home className='w-4 h-4 mr-1 lg:mr-2' />
                      <span className='hidden sm:inline'>Homepage</span>
                    </Button>
                  </Link>
                  <div className='hidden lg:flex items-center gap-3 bg-gray-700/30 rounded-full px-4 py-2 backdrop-blur-sm'>
                    <div className='w-2 h-2 bg-green-400 rounded-full animate-pulse'></div>
                    <span className='text-sm text-gray-300'>Online</span>
                  </div>
                  <NotificationBell />
                  <UserButton
                    afterSignOutUrl='/'
                    appearance={{
                      elements: {
                        userButtonAvatarBox:
                          'size-8 border-2 border-yellow-400/50',
                      },
                    }}
                  />
                  <div className='lg:hidden'>
                    <ModeToggle />
                  </div>
                </div>
              </div>
            </header>

            {/* Auto-join to default server */}
            {/* DISABLED: This was causing automatic redirects and misdirection issues */}

            {/* Dashboard Stats - Mobile-First Cards */}
            <div className='grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-6 sm:mb-8'>
              <Card className='bg-gradient-to-br from-blue-600/20 via-blue-600/10 to-blue-700/20 border border-blue-400/30 backdrop-blur-md hover:border-blue-400/50 transition-all duration-500 hover:transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-400/20 touch-manipulation cursor-pointer'>
                <CardContent className='p-3 sm:p-4 md:p-6'>
                  <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between'>
                    <div className='mb-2 sm:mb-0'>
                      <p className='text-blue-200 text-xs sm:text-sm font-medium'>
                        Active Servers
                      </p>
                      <p className='text-xl sm:text-2xl md:text-3xl font-bold text-white'>
                        {servers?.length || 0}
                      </p>
                    </div>
                    <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-blue-500/20 rounded-lg sm:rounded-xl flex items-center justify-center self-end sm:self-auto'>
                      <Users className='w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-blue-400' />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className='bg-gradient-to-br from-green-600/20 via-green-600/10 to-green-700/20 border border-green-400/30 backdrop-blur-md hover:border-green-400/50 transition-all duration-500 hover:transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-green-400/20 touch-manipulation cursor-pointer'>
                <CardContent className='p-3 sm:p-4 md:p-6'>
                  <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between'>
                    <div className='mb-2 sm:mb-0'>
                      <p className='text-green-200 text-xs sm:text-sm font-medium'>
                        Account Status
                      </p>
                      <p className='text-lg sm:text-xl font-bold text-white'>
                        {profile.isAdmin ? 'Admin' : 'Member'}
                      </p>
                    </div>
                    <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-green-500/20 rounded-lg sm:rounded-xl flex items-center justify-center self-end sm:self-auto'>
                      <Shield className='w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-green-400' />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className='bg-gradient-to-br from-purple-600/20 via-purple-600/10 to-purple-700/20 border border-purple-400/30 backdrop-blur-md hover:border-purple-400/50 transition-all duration-500 hover:transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-400/20 touch-manipulation cursor-pointer'>
                <CardContent className='p-3 sm:p-4 md:p-6'>
                  <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between'>
                    <div className='mb-2 sm:mb-0'>
                      <p className='text-purple-200 text-xs sm:text-sm font-medium'>
                        Security
                      </p>
                      <p className='text-lg sm:text-xl font-bold text-white'>
                        {profile.twoFactorEnabled ? 'Secure' : 'Basic'}
                      </p>
                    </div>
                    <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-purple-500/20 rounded-lg sm:rounded-xl flex items-center justify-center self-end sm:self-auto'>
                      <Activity className='w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-purple-400' />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className='bg-gradient-to-br from-yellow-600/20 via-yellow-600/10 to-yellow-700/20 border border-yellow-400/30 backdrop-blur-md hover:border-yellow-400/50 transition-all duration-500 hover:transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-yellow-400/20 touch-manipulation cursor-pointer'>
                <CardContent className='p-3 sm:p-4 md:p-6'>
                  <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between'>
                    <div className='mb-2 sm:mb-0'>
                      <p className='text-yellow-200 text-xs sm:text-sm font-medium'>
                        Subscription
                      </p>
                      <p className='text-lg sm:text-xl font-bold text-white'>
                        Premium
                      </p>
                    </div>
                    <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-yellow-500/20 rounded-lg sm:rounded-xl flex items-center justify-center self-end sm:self-auto'>
                      <TrendingUp className='w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-yellow-400' />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Servers Section - Enhanced */}
            <Card className='mb-8 bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 border border-gray-600/30 backdrop-blur-md hover:border-blue-400/50 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-400/10'>
              <CardHeader className='pb-6'>
                <CardTitle className='flex items-center gap-3 text-white'>
                  <div className='w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg'>
                    <Users className='h-6 w-6 text-white' />
                  </div>
                  <div>
                    <span className='text-2xl font-bold bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent'>
                      Traders Utopia Community
                    </span>
                    <span className='block text-sm text-gray-400 font-normal'>
                      Professional Trading Environment
                    </span>
                  </div>
                </CardTitle>
                <CardDescription className='text-gray-300 ml-15'>
                  {profile.isAdmin
                    ? '🛡️ You have admin access - manage the community server and moderate discussions'
                    : '👀 You have read-only access - view the community discussions and trading insights'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                  {servers?.map((server, index) => (
                    <SubscriptionProtectedLink
                      key={server.id}
                      href={`/servers/${server.id}`}
                    >
                      <Card className='group bg-gradient-to-br from-gray-700/50 to-gray-800/50 border border-gray-600/30 hover:border-yellow-400/50 transition-all duration-500 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-yellow-400/20 backdrop-blur-sm cursor-pointer'>
                        <CardContent className='p-6'>
                          <div className='flex items-center gap-4'>
                            {server.imageUrl ? (
                              <div className='w-14 h-14 rounded-2xl overflow-hidden border-2 border-gray-600 group-hover:border-yellow-400/50 transition-all duration-300'>
                                <img
                                  src={server.imageUrl}
                                  alt={server.name}
                                  className='w-full h-full object-cover group-hover:scale-110 transition-transform duration-300'
                                />
                              </div>
                            ) : (
                              <div className='w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg group-hover:scale-110 transition-transform duration-300'>
                                {server.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className='flex-1'>
                              <h3 className='font-bold text-white text-lg group-hover:text-yellow-300 transition-colors'>
                                {server.name}
                              </h3>
                              <div className='flex items-center gap-2 mt-1'>
                                <div
                                  className={`w-2 h-2 rounded-full ${profile.isAdmin ? 'bg-green-400' : 'bg-blue-400'}`}
                                ></div>
                                <span className='text-sm text-gray-400'>
                                  {profile.isAdmin
                                    ? 'Admin Access'
                                    : 'Member Access'}
                                </span>
                              </div>
                              <p className='text-xs text-gray-500 mt-2'>
                                Active trading community with real-time signals
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </SubscriptionProtectedLink>
                  ))}
                </div>

                {(servers?.length || 0) === 0 && (
                  <div className='text-center py-12 bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-2xl border border-gray-600/30 backdrop-blur-sm'>
                    <div className='w-20 h-20 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6'>
                      <Users className='h-10 w-10 text-blue-400' />
                    </div>
                    <h3 className='text-xl font-bold text-white mb-2'>
                      Setting up your community server...
                    </h3>
                    <p className='text-gray-400'>
                      You'll be automatically joined to Traders Utopia
                    </p>
                    <div className='flex items-center justify-center gap-2 mt-4'>
                      <div className='w-2 h-2 bg-blue-400 rounded-full animate-pulse'></div>
                      <div className='w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-100'></div>
                      <div className='w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-200'></div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Enhanced Tabs - Mobile-First Design */}
            <div className='w-full mb-6 sm:mb-8'>
              <Tabs defaultValue='profile' className='w-full'>
                {/* Mobile-Optimized Tab Navigation - Dynamic Grid Based on Admin Status */}
                <div className='flex justify-center mb-6 sm:mb-8'>
                  <TabsList
                    className={`grid ${profile.isAdmin ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} w-full max-w-md sm:max-w-lg ${profile.isAdmin ? 'lg:max-w-4xl' : 'lg:max-w-2xl'} bg-gray-900/80 backdrop-blur-xl border border-gray-600/40 rounded-2xl p-1.5 sm:p-2 shadow-2xl h-auto min-h-[80px] sm:min-h-[88px]`}
                  >
                    <TabsTrigger
                      value='profile'
                      className='flex flex-col items-center justify-center gap-2 py-4 px-3 sm:px-4 text-white rounded-xl transition-all duration-300 hover:bg-gray-700/50 data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg touch-manipulation min-h-[72px] sm:min-h-[80px] relative group h-auto whitespace-normal'
                    >
                      <User className='h-5 w-5 sm:h-6 sm:w-6 transition-transform group-hover:scale-110' />
                      <span className='text-xs sm:text-sm font-medium tracking-wide'>
                        Profile
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value='security'
                      className='flex flex-col items-center justify-center gap-2 py-4 px-3 sm:px-4 text-white rounded-xl transition-all duration-300 hover:bg-gray-700/50 data-[state=active]:bg-gradient-to-br data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white data-[state=active]:shadow-lg touch-manipulation min-h-[72px] sm:min-h-[80px] relative group h-auto whitespace-normal'
                    >
                      <Shield className='h-5 w-5 sm:h-6 sm:w-6 transition-transform group-hover:scale-110' />
                      <span className='text-xs sm:text-sm font-medium tracking-wide'>
                        Security
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value='settings'
                      className='flex flex-col items-center justify-center gap-2 py-4 px-3 sm:px-4 text-white rounded-xl transition-all duration-300 hover:bg-gray-700/50 data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg touch-manipulation min-h-[72px] sm:min-h-[80px] relative group h-auto whitespace-normal'
                    >
                      <Settings className='h-5 w-5 sm:h-6 sm:w-6 transition-transform group-hover:scale-110' />
                      <span className='text-xs sm:text-sm font-medium tracking-wide'>
                        Settings
                      </span>
                    </TabsTrigger>
                    {/* Admin Tab - Only visible to admin users */}
                    {profile.isAdmin && (
                      <TabsTrigger
                        value='admin'
                        className='flex flex-col items-center justify-center gap-2 py-4 px-3 sm:px-4 text-white rounded-xl transition-all duration-300 hover:bg-gray-700/50 data-[state=active]:bg-gradient-to-br data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg touch-manipulation min-h-[72px] sm:min-h-[80px] relative group h-auto whitespace-normal'
                      >
                        <UserCog className='h-5 w-5 sm:h-6 sm:w-6 transition-transform group-hover:scale-110' />
                        <span className='text-xs sm:text-sm font-medium tracking-wide'>
                          Admin
                        </span>
                      </TabsTrigger>
                    )}
                  </TabsList>
                </div>

                {/* Profile Tab Content - Mobile Optimized with Proper Spacing */}
                <TabsContent value='profile' className='mt-6 w-full'>
                  <div className='bg-gradient-to-br from-gray-800/50 via-gray-900/40 to-black/60 rounded-2xl border border-gray-600/30 backdrop-blur-md shadow-2xl'>
                    <div className='p-4 sm:p-6 lg:p-8'>
                      <div className='flex items-center gap-3 mb-6'>
                        <div className='w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg'>
                          <User className='h-5 w-5 text-white' />
                        </div>
                        <div>
                          <h2 className='text-xl sm:text-2xl font-bold text-white'>
                            User Profile
                          </h2>
                          <p className='text-gray-400 text-sm'>
                            Manage your account information
                          </p>
                        </div>
                      </div>
                      <div className='bg-gray-900/40 rounded-xl p-4 sm:p-6 border border-gray-700/30'>
                        <DiscordProfile />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Security Tab Content - Mobile Optimized with Proper Spacing */}
                <TabsContent value='security' className='mt-6 w-full'>
                  <div className='bg-gradient-to-br from-gray-800/50 via-gray-900/40 to-black/60 rounded-2xl border border-gray-600/30 backdrop-blur-md shadow-2xl'>
                    <div className='p-4 sm:p-6 lg:p-8'>
                      <div className='flex items-center gap-3 mb-6'>
                        <div className='w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg'>
                          <Shield className='h-5 w-5 text-white' />
                        </div>
                        <div>
                          <h2 className='text-xl sm:text-2xl font-bold text-white'>
                            Account Security
                          </h2>
                          <p className='text-gray-400 text-sm'>
                            Protect your account with enhanced security
                          </p>
                        </div>
                      </div>
                      <div className='bg-gray-900/40 rounded-xl p-4 sm:p-6 border border-gray-700/30'>
                        <TwoFactorAuth
                          initialTwoFactorEnabled={profile.twoFactorEnabled}
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Settings Tab Content - Mobile Optimized with Proper Spacing */}
                <TabsContent value='settings' className='mt-6 w-full'>
                  <div className='space-y-4 sm:space-y-6 w-full'>
                    {/* Subscription Management Card */}
                    <div className='bg-gradient-to-br from-gray-800/50 via-gray-900/40 to-black/60 rounded-2xl border border-gray-600/30 backdrop-blur-md shadow-2xl'>
                      <div className='p-4 sm:p-6 lg:p-8'>
                        <div className='flex items-center gap-3 mb-6'>
                          <div className='w-10 h-10 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg'>
                            <Crown className='h-5 w-5 text-white' />
                          </div>
                          <div>
                            <h2 className='text-xl sm:text-2xl font-bold text-white'>
                              Subscription
                            </h2>
                            <p className='text-gray-400 text-sm'>
                              Manage your premium membership
                            </p>
                          </div>
                        </div>
                        <div className='w-full'>
                          <SubscriptionManager />
                        </div>
                      </div>
                    </div>

                    {/* General Settings Card */}
                    <div className='bg-gradient-to-br from-gray-800/50 via-gray-900/40 to-black/60 rounded-2xl border border-gray-600/30 backdrop-blur-md shadow-2xl'>
                      <div className='p-4 sm:p-6 lg:p-8'>
                        <div className='flex items-center gap-3 mb-6'>
                          <div className='w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg'>
                            <Settings className='h-5 w-5 text-white' />
                          </div>
                          <div>
                            <h2 className='text-xl sm:text-2xl font-bold text-white'>
                              General Settings
                            </h2>
                            <p className='text-gray-400 text-sm'>
                              Customize your experience
                            </p>
                          </div>
                        </div>

                        <div className='space-y-4 w-full'>
                          {/* Notifications Section */}
                          <div className='bg-gray-900/40 rounded-xl p-4 sm:p-6 border border-gray-700/30'>
                            <div className='flex items-center gap-3 mb-4'>
                              <div className='w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center'>
                                <Bell className='h-4 w-4 text-yellow-400' />
                              </div>
                              <div>
                                <h3 className='text-lg font-semibold text-white'>
                                  Notifications
                                </h3>
                                <p className='text-gray-400 text-sm'>
                                  Configure your notification preferences
                                </p>
                              </div>
                            </div>
                            <NotificationSettings />
                          </div>

                          {/* Theme Setting */}
                          <div className='bg-gray-900/40 rounded-xl p-4 sm:p-6 border border-gray-700/30'>
                            <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
                              <div className='flex items-center gap-3'>
                                <div className='w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center'>
                                  <div className='w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-blue-600'></div>
                                </div>
                                <div>
                                  <h3 className='text-lg font-semibold text-white'>
                                    Theme
                                  </h3>
                                  <p className='text-gray-400 text-sm'>
                                    Switch between light and dark mode
                                  </p>
                                </div>
                              </div>
                              <div className='self-start sm:self-auto'>
                                <ModeToggle />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Admin Tab Content - Only accessible to admin users */}
                {profile.isAdmin && (
                  <TabsContent value='admin' className='mt-6 w-full'>
                    <div className='bg-gradient-to-br from-gray-800/50 via-gray-900/40 to-black/60 rounded-2xl border border-gray-600/30 backdrop-blur-md shadow-2xl'>
                      <div className='p-4 sm:p-6 lg:p-8'>
                        <div className='flex items-center gap-3 mb-6'>
                          <div className='w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg'>
                            <UserCog className='h-5 w-5 text-white' />
                          </div>
                          <div>
                            <h2 className='text-xl sm:text-2xl font-bold text-white'>
                              Admin Panel
                            </h2>
                            <p className='text-gray-400 text-sm'>
                              Manage users, subscriptions, and system
                              administration
                            </p>
                          </div>
                        </div>
                        <div className='bg-gray-900/40 rounded-xl p-4 sm:p-6 border border-gray-700/30'>
                          <UserManagement />
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                )}
              </Tabs>
            </div>
          </main>
        </div>
      </div>
    </ProductPaymentGate>
  );
}
