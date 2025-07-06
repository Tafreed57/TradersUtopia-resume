import { UserButton } from '@clerk/nextjs';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { SubscriptionProtectedLink } from '@/components/subscription-protected-link';
import { getCurrentProfileWithSync, getAllServers } from '@/lib/query';
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
  Crown,
  Users,
  Sparkles,
  Activity,
  TrendingUp,
  Home,
  Bell,
  UserCog,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { GlobalMobileMenu } from '@/components/global-mobile-menu';
import { DashboardAutoJoin } from '@/components/dashboard-auto-join';
import { UserManagement } from '@/components/admin/user-management';
import { NotificationSettings } from '@/components/notifications/notification-settings';
import { ProductPaymentGate } from '@/components/product-payment-gate';
import { SubscriptionManager } from '@/components/subscription/subscription-manager';
import { PasswordManager } from '@/components/user/password-manager';
import { UserDetails } from '@/components/user/user-details';

export default async function Dashboard() {
  const profile = await getCurrentProfileWithSync();

  // Get user's servers but don't redirect - let them choose what to do
  const servers = await getAllServers(profile.id);

  // Configure which Stripe products are allowed for dashboard access
  const allowedProductIds = [
    'prod_SWIyAf2tfVrJao', // Your current product ID
    // Add more product IDs here as you create them
  ];

  const dashboardContent = (
    <div className='min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white relative'>
      {/* Animated Background Effects */}
      <div className='absolute inset-0 pointer-events-none overflow-hidden'>
        <div className='absolute -top-40 -right-40 w-80 h-80 bg-blue-500/8 rounded-full blur-3xl animate-pulse'></div>
        <div className='absolute top-60 -left-40 w-96 h-96 bg-purple-500/6 rounded-full blur-3xl animate-pulse delay-1000'></div>
        <div className='absolute bottom-40 right-20 w-64 h-64 bg-yellow-500/8 rounded-full blur-3xl animate-pulse delay-2000'></div>
        <div className='absolute top-20 left-1/2 w-72 h-72 bg-green-500/5 rounded-full blur-3xl animate-pulse delay-3000'></div>
      </div>

      <div className='relative z-10 dashboard-mobile-container w-full'>
        <main className='max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10'>
          {/* Enhanced Header - Mobile-Optimized with Better Spacing */}
          <header className='w-full mobile-header-spacing'>
            {/* Mobile Header */}
            <div className='flex md:hidden items-center justify-between w-full p-4 sm:p-5 bg-gradient-to-r from-gray-800/60 via-gray-800/40 to-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-700/30 shadow-2xl card-mobile-safe'>
              <div className='flex items-center gap-3 min-w-0 flex-1-mobile-safe'>
                <div className='w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0'>
                  <Sparkles className='w-5 h-5 sm:w-6 sm:h-6 text-black' />
                </div>
                <div className='min-w-0 flex-1-mobile-safe'>
                  <h1 className='text-lg sm:text-xl font-bold bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent truncate-mobile'>
                    Dashboard
                  </h1>
                  <p className='text-gray-400 text-sm truncate-mobile mt-1'>
                    Welcome, {profile.name?.split(' ')[0]}
                  </p>
                </div>
              </div>
              <div className='flex items-center gap-2 sm:gap-3 flex-shrink-0'>
                <NotificationBell />
                <UserButton
                  afterSignOutUrl='/'
                  appearance={{
                    elements: {
                      userButtonAvatarBox:
                        'size-8 sm:size-9 border-2 border-yellow-400/50',
                    },
                  }}
                />
                <GlobalMobileMenu />
              </div>
            </div>

            {/* Desktop Header */}
            <div className='hidden md:flex items-center justify-between w-full h-20 gap-4 bg-gradient-to-r from-gray-800/60 via-gray-800/40 to-gray-900/60 backdrop-blur-xl rounded-2xl border border-gray-700/30 px-6 lg:px-8 shadow-2xl overflow-hidden'>
              <div className='flex items-center gap-6 min-w-0 flex-1 overflow-hidden'>
                <div className='flex items-center gap-4 min-w-0 flex-1 overflow-hidden'>
                  <div className='w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0'>
                    <Sparkles className='w-6 h-6 text-black' />
                  </div>
                  <div className='min-w-0 flex-1 overflow-hidden'>
                    <h1 className='text-xl lg:text-2xl font-bold bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent truncate'>
                      Trading Dashboard
                    </h1>
                    <p className='text-gray-400 text-sm truncate'>
                      Welcome back, {profile.name}
                    </p>
                  </div>
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
              </div>
            </div>
          </header>

          {/* Auto-join to default server */}
          <DashboardAutoJoin
            hasServers={(servers?.length || 0) > 0}
            userId={profile.userId}
          />

          {/* Dashboard Stats - Mobile-First Cards with Enhanced Spacing */}
          <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6 lg:gap-8 mb-10 sm:mb-12 w-full grid-mobile-safe'>
            <Card className='bg-gradient-to-br from-blue-600/20 via-blue-600/10 to-blue-700/20 border border-blue-400/30 backdrop-blur-md hover:border-blue-400/50 transition-all duration-500 hover:transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-400/20 touch-manipulation cursor-pointer min-w-0 card-mobile-safe'>
              <CardContent className='p-4 sm:p-5 md:p-6 lg:p-7 mobile-spacing-enhanced'>
                <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between min-w-0'>
                  <div className='mb-3 sm:mb-0 min-w-0 flex-1-mobile-safe'>
                    <p className='text-blue-200 text-sm sm:text-base font-medium truncate-mobile'>
                      Active Servers
                    </p>
                    <p className='text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white mt-1'>
                      {servers?.length || 0}
                    </p>
                  </div>
                  <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 bg-blue-500/20 rounded-lg sm:rounded-xl flex items-center justify-center self-end sm:self-auto flex-shrink-0'>
                    <Users className='w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 text-blue-400' />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className='bg-gradient-to-br from-green-600/20 via-green-600/10 to-green-700/20 border border-green-400/30 backdrop-blur-md hover:border-green-400/50 transition-all duration-500 hover:transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-green-400/20 touch-manipulation cursor-pointer min-w-0 card-mobile-safe'>
              <CardContent className='p-4 sm:p-5 md:p-6 lg:p-7 mobile-spacing-enhanced'>
                <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between min-w-0'>
                  <div className='mb-3 sm:mb-0 min-w-0 flex-1-mobile-safe'>
                    <p className='text-green-200 text-sm sm:text-base font-medium truncate-mobile'>
                      Account Status
                    </p>
                    <p className='text-base sm:text-xl md:text-2xl font-bold text-white truncate-mobile mt-1'>
                      {profile.isAdmin ? 'Admin' : 'Member'}
                    </p>
                  </div>
                  <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 bg-green-500/20 rounded-lg sm:rounded-xl flex items-center justify-center self-end sm:self-auto flex-shrink-0'>
                    <Shield className='w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 text-green-400' />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className='bg-gradient-to-br from-purple-600/20 via-purple-600/10 to-purple-700/20 border border-purple-400/30 backdrop-blur-md hover:border-purple-400/50 transition-all duration-500 hover:transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-400/20 touch-manipulation cursor-pointer min-w-0 card-mobile-safe'>
              <CardContent className='p-4 sm:p-5 md:p-6 lg:p-7 mobile-spacing-enhanced'>
                <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between min-w-0'>
                  <div className='mb-3 sm:mb-0 min-w-0 flex-1-mobile-safe'>
                    <p className='text-purple-200 text-sm sm:text-base font-medium truncate-mobile'>
                      Security
                    </p>
                    <p className='text-base sm:text-xl md:text-2xl font-bold text-white truncate-mobile mt-1'>
                      Secure
                    </p>
                  </div>
                  <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 bg-purple-500/20 rounded-lg sm:rounded-xl flex items-center justify-center self-end sm:self-auto flex-shrink-0'>
                    <Activity className='w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 text-purple-400' />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className='bg-gradient-to-br from-yellow-600/20 via-yellow-600/10 to-yellow-700/20 border border-yellow-400/30 backdrop-blur-md hover:border-yellow-400/50 transition-all duration-500 hover:transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-yellow-400/20 touch-manipulation cursor-pointer min-w-0 card-mobile-safe'>
              <CardContent className='p-4 sm:p-5 md:p-6 lg:p-7 mobile-spacing-enhanced'>
                <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between min-w-0'>
                  <div className='mb-3 sm:mb-0 min-w-0 flex-1-mobile-safe'>
                    <p className='text-yellow-200 text-sm sm:text-base font-medium truncate-mobile'>
                      Subscription
                    </p>
                    <p className='text-base sm:text-xl md:text-2xl font-bold text-white truncate-mobile mt-1'>
                      Premium
                    </p>
                  </div>
                  <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 bg-yellow-500/20 rounded-lg sm:rounded-xl flex items-center justify-center self-end sm:self-auto flex-shrink-0'>
                    <TrendingUp className='w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 text-yellow-400' />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Servers Section - Enhanced with Better Mobile Spacing */}
          <Card className='mb-12 sm:mb-16 bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 border border-gray-600/30 backdrop-blur-md hover:border-blue-400/50 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-400/10 w-full card-mobile-safe'>
            <CardHeader className='pb-8 sm:pb-10 mobile-spacing-enhanced'>
              <CardTitle className='flex flex-col sm:flex-row sm:items-center gap-4 text-white'>
                <div className='w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0'>
                  <Users className='h-6 w-6 sm:h-7 sm:w-7 text-white' />
                </div>
                <div className='min-w-0 flex-1-mobile-safe'>
                  <span className='text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent block truncate-mobile'>
                    Traders Utopia Community
                  </span>
                  <span className='block text-sm sm:text-base text-gray-400 font-normal truncate-mobile mt-2'>
                    Professional Trading Environment
                  </span>
                </div>
              </CardTitle>
              <CardDescription className='text-gray-300 text-sm sm:text-base mt-4'>
                <span className='block truncate-mobile'>
                  {profile.isAdmin
                    ? '🛡️ You have admin access - manage the community server and moderate discussions'
                    : '👀 You have read-only access - view the community discussions and trading insights'}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className='px-6 pb-8 sm:pb-10 card-mobile-safe'>
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-8 w-full grid-mobile-safe'>
                {servers?.map((server, index) => (
                  <SubscriptionProtectedLink
                    key={server.id}
                    href={`/servers/${server.id}`}
                  >
                    <Card className='group bg-gradient-to-br from-gray-700/50 to-gray-800/50 border border-gray-600/30 hover:border-yellow-400/50 transition-all duration-500 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-yellow-400/20 backdrop-blur-sm cursor-pointer w-full card-mobile-safe'>
                      <CardContent className='p-6 mobile-spacing-enhanced'>
                        <div className='flex items-start gap-4'>
                          {server.imageUrl ? (
                            <div className='w-16 h-16 rounded-2xl overflow-hidden border-2 border-gray-600 group-hover:border-yellow-400/50 transition-all duration-300 flex-shrink-0'>
                              <Image
                                src={server.imageUrl}
                                alt={server.name}
                                width={64}
                                height={64}
                                className='w-full h-full object-cover group-hover:scale-110 transition-transform duration-300'
                              />
                            </div>
                          ) : (
                            <div className='w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg group-hover:scale-110 transition-transform duration-300 flex-shrink-0'>
                              {server.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className='flex-1 min-w-0 space-y-3'>
                            <div className='space-y-2'>
                              <h3 className='font-bold text-white text-lg group-hover:text-yellow-300 transition-colors leading-tight overflow-hidden'>
                                <span className='block'>{server.name}</span>
                              </h3>
                              <div className='flex items-center gap-2'>
                                <div
                                  className={`w-2 h-2 rounded-full ${profile.isAdmin ? 'bg-green-400' : 'bg-blue-400'} flex-shrink-0`}
                                ></div>
                                <span className='text-sm text-gray-400'>
                                  {profile.isAdmin
                                    ? 'Admin Access'
                                    : 'Member Access'}
                                </span>
                              </div>
                            </div>
                            <p className='text-xs text-gray-500 leading-relaxed'>
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
                <div className='text-center py-16 sm:py-20 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-indigo-500/10 rounded-2xl border border-blue-400/30 backdrop-blur-sm mobile-spacing-enhanced'>
                  <div className='w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-blue-500/30 to-purple-600/30 rounded-2xl flex items-center justify-center mx-auto mb-8 animate-pulse'>
                    <Users className='h-10 w-10 sm:h-12 sm:w-12 text-blue-400' />
                  </div>
                  <h3 className='text-xl sm:text-2xl font-bold text-white mb-4'>
                    🚀 Joining Traders Utopia Community...
                  </h3>
                  <p className='text-gray-300 mb-8 px-4 text-base sm:text-lg'>
                    Setting up your access to the premium trading server
                  </p>
                  <div className='flex items-center justify-center gap-2 mb-6'>
                    <div className='w-2 h-2 bg-blue-400 rounded-full animate-pulse'></div>
                    <div className='w-2 h-2 bg-purple-400 rounded-full animate-pulse delay-100'></div>
                    <div className='w-2 h-2 bg-indigo-400 rounded-full animate-pulse delay-200'></div>
                  </div>
                  <p className='text-sm sm:text-base text-gray-400 px-4'>
                    This should take just a moment...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Simplified Tabs - Clean Mobile & Desktop Design */}
          <div className='w-full mb-8'>
            <Tabs defaultValue='profile' className='w-full'>
              <div className='w-full max-w-4xl mx-auto px-2 sm:px-4 mb-8'>
                <TabsList
                  className={`grid ${profile.isAdmin ? 'grid-cols-4' : 'grid-cols-3'} w-full h-auto bg-gray-800/50 border border-gray-600/50 rounded-lg p-1 gap-1 !bg-gray-800/50 !h-auto`}
                >
                  <TabsTrigger
                    value='profile'
                    className='!flex !flex-col !items-center gap-1 sm:gap-2 py-2 sm:py-3 px-2 sm:px-3 !text-white data-[state=active]:!bg-blue-600 data-[state=active]:!text-white !rounded-md transition-all duration-200 hover:!bg-gray-700/50 min-h-[50px] sm:min-h-[60px] !whitespace-normal'
                  >
                    <User className='h-4 w-4 sm:h-5 sm:w-5' />
                    <span className='text-xs sm:text-sm font-medium'>
                      Profile
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    value='security'
                    className='!flex !flex-col !items-center gap-1 sm:gap-2 py-2 sm:py-3 px-2 sm:px-3 !text-white data-[state=active]:!bg-green-600 data-[state=active]:!text-white !rounded-md transition-all duration-200 hover:!bg-gray-700/50 min-h-[50px] sm:min-h-[60px] !whitespace-normal'
                  >
                    <Shield className='h-4 w-4 sm:h-5 sm:w-5' />
                    <span className='text-xs sm:text-sm font-medium'>
                      Security
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    value='settings'
                    className='!flex !flex-col !items-center gap-1 sm:gap-2 py-2 sm:py-3 px-2 sm:px-3 !text-white data-[state=active]:!bg-purple-600 data-[state=active]:!text-white !rounded-md transition-all duration-200 hover:!bg-gray-700/50 min-h-[50px] sm:min-h-[60px] !whitespace-normal'
                  >
                    <Settings className='h-4 w-4 sm:h-5 sm:w-5' />
                    <span className='text-xs sm:text-sm font-medium'>
                      Settings
                    </span>
                  </TabsTrigger>
                  {profile.isAdmin && (
                    <TabsTrigger
                      value='admin'
                      className='!flex !flex-col !items-center gap-1 sm:gap-2 py-2 sm:py-3 px-2 sm:px-3 !text-white data-[state=active]:!bg-red-600 data-[state=active]:!text-white !rounded-md transition-all duration-200 hover:!bg-gray-700/50 min-h-[50px] sm:min-h-[60px] !whitespace-normal'
                    >
                      <UserCog className='h-4 w-4 sm:h-5 sm:w-5' />
                      <span className='text-xs sm:text-sm font-medium'>
                        Admin
                      </span>
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              {/* Profile Tab Content */}
              <TabsContent value='profile' className='w-full'>
                <div className='bg-gradient-to-br from-gray-800/50 via-gray-900/40 to-black/60 rounded-xl sm:rounded-2xl border border-gray-600/30 backdrop-blur-md shadow-2xl w-full'>
                  <div className='p-4 sm:p-6 lg:p-8'>
                    <div className='flex items-center gap-4 sm:gap-5 mb-6 sm:mb-8'>
                      <div className='w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg flex-shrink-0'>
                        <User className='h-6 w-6 sm:h-7 sm:w-7 text-white' />
                      </div>
                      <div className='min-w-0 flex-1'>
                        <h2 className='text-xl sm:text-2xl lg:text-3xl font-bold text-white truncate'>
                          User Profile
                        </h2>
                        <p className='text-gray-400 text-sm sm:text-base truncate mt-1 sm:mt-2'>
                          Manage your account information
                        </p>
                      </div>
                    </div>
                    <div className='bg-gray-900/40 rounded-lg sm:rounded-xl p-4 sm:p-6 lg:p-8 border border-gray-700/30'>
                      <UserDetails />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Security Tab Content */}
              <TabsContent value='security' className='w-full'>
                <div className='bg-gradient-to-br from-gray-800/50 via-gray-900/40 to-black/60 rounded-xl sm:rounded-2xl border border-gray-600/30 backdrop-blur-md shadow-2xl w-full'>
                  <div className='p-4 sm:p-6 lg:p-8'>
                    <div className='flex items-center gap-4 sm:gap-5 mb-6 sm:mb-8'>
                      <div className='w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg flex-shrink-0'>
                        <Shield className='h-6 w-6 sm:h-7 sm:w-7 text-white' />
                      </div>
                      <div className='min-w-0 flex-1'>
                        <h2 className='text-xl sm:text-2xl lg:text-3xl font-bold text-white truncate'>
                          Account Security
                        </h2>
                        <p className='text-gray-400 text-sm sm:text-base truncate mt-1 sm:mt-2'>
                          Protect your account with enhanced security
                        </p>
                      </div>
                    </div>
                    <div className='bg-gray-900/40 rounded-lg sm:rounded-xl p-4 sm:p-6 lg:p-8 border border-gray-700/30'>
                      <PasswordManager />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Settings Tab Content */}
              <TabsContent value='settings' className='w-full'>
                <div className='space-y-6 sm:space-y-8 w-full'>
                  {/* Subscription Management Card */}
                  <div className='bg-gradient-to-br from-gray-800/50 via-gray-900/40 to-black/60 rounded-xl sm:rounded-2xl border border-gray-600/30 backdrop-blur-md shadow-2xl w-full'>
                    <div className='p-4 sm:p-6 lg:p-8'>
                      <div className='flex items-center gap-4 sm:gap-5 mb-6 sm:mb-8'>
                        <div className='w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg flex-shrink-0'>
                          <Crown className='h-6 w-6 sm:h-7 sm:w-7 text-white' />
                        </div>
                        <div className='min-w-0 flex-1'>
                          <h2 className='text-xl sm:text-2xl lg:text-3xl font-bold text-white truncate'>
                            Subscription
                          </h2>
                          <p className='text-gray-400 text-sm sm:text-base truncate mt-1 sm:mt-2'>
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
                  <div className='bg-gradient-to-br from-gray-800/50 via-gray-900/40 to-black/60 rounded-xl sm:rounded-2xl border border-gray-600/30 backdrop-blur-md shadow-2xl w-full'>
                    <div className='p-4 sm:p-6 lg:p-8'>
                      <div className='flex items-center gap-4 sm:gap-5 mb-6 sm:mb-8'>
                        <div className='w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg flex-shrink-0'>
                          <Settings className='h-6 w-6 sm:h-7 sm:w-7 text-white' />
                        </div>
                        <div className='min-w-0 flex-1'>
                          <h2 className='text-xl sm:text-2xl lg:text-3xl font-bold text-white truncate'>
                            General Settings
                          </h2>
                          <p className='text-gray-400 text-sm sm:text-base truncate mt-1 sm:mt-2'>
                            Customize your experience
                          </p>
                        </div>
                      </div>

                      {/* Notifications Section */}
                      <div className='bg-gray-900/40 rounded-lg sm:rounded-xl p-4 sm:p-6 lg:p-8 border border-gray-700/30'>
                        <div className='flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6'>
                          <div className='w-10 h-10 sm:w-12 sm:h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center flex-shrink-0'>
                            <Bell className='h-5 w-5 sm:h-6 sm:w-6 text-yellow-400' />
                          </div>
                          <div className='min-w-0 flex-1'>
                            <h3 className='text-lg sm:text-xl font-semibold text-white truncate'>
                              Notifications
                            </h3>
                            <p className='text-gray-400 text-sm sm:text-base truncate mt-1'>
                              Configure your notification preferences
                            </p>
                          </div>
                        </div>
                        <div className='w-full'>
                          <NotificationSettings />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Admin Tab Content - Only accessible to admin users */}
              {profile.isAdmin && (
                <TabsContent value='admin' className='w-full'>
                  <div className='bg-gradient-to-br from-gray-800/50 via-gray-900/40 to-black/60 rounded-xl sm:rounded-2xl border border-gray-600/30 backdrop-blur-md shadow-2xl w-full'>
                    <div className='p-4 sm:p-6 lg:p-8'>
                      <div className='flex items-center gap-4 sm:gap-5 mb-6 sm:mb-8'>
                        <div className='w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-red-500 to-red-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg flex-shrink-0'>
                          <UserCog className='h-6 w-6 sm:h-7 sm:w-7 text-white' />
                        </div>
                        <div className='min-w-0 flex-1'>
                          <h2 className='text-xl sm:text-2xl lg:text-3xl font-bold text-white truncate'>
                            Admin Panel
                          </h2>
                          <p className='text-gray-400 text-sm sm:text-base truncate mt-1 sm:mt-2'>
                            Manage users and server settings
                          </p>
                        </div>
                      </div>
                      <div className='bg-gray-900/40 rounded-lg sm:rounded-xl p-4 sm:p-6 lg:p-8 border border-gray-700/30'>
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
  );

  // Return dashboard with proper security - bypass gate for legitimate users
  const shouldBypassGate =
    profile.isAdmin ||
    profile.subscriptionStatus === 'ACTIVE' ||
    (profile.subscriptionEnd && new Date(profile.subscriptionEnd) > new Date()); // Valid subscription not yet expired

  // Only log when access is being restricted
  if (!shouldBypassGate) {
    console.log('🔒 [Dashboard Access Restricted]:', {
      email: profile.email,
      isAdmin: profile.isAdmin,
      subscriptionStatus: profile.subscriptionStatus,
      subscriptionEnd: profile.subscriptionEnd,
      subscriptionEndValid: profile.subscriptionEnd
        ? new Date(profile.subscriptionEnd) > new Date()
        : false,
      reason: 'User does not have valid subscription or admin access',
    });
  }

  return shouldBypassGate ? (
    dashboardContent
  ) : (
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
      adminBypass={false} // Let the component handle its own subscription checks
    >
      {dashboardContent}
    </ProductPaymentGate>
  );
}
