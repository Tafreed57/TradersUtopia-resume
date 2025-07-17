import { Button } from '@/components/ui/button';
import { SmartEntryButton } from '@/components/smart-entry-button';
import { AutoRouteAfterSignIn } from '@/components/auto-route-after-signin';
import { SharedNavbar } from '@/components/shared-navbar';
// import { SubscriptionProtectedLink } from '@/components/subscription-protected-link';
import { HeroBanner } from '@/components/hero-banner';
import { TrackRecordMinimal } from '@/components/track-record/track-record-minimal';
import { Suspense } from 'react';
import NextImage from 'next/image';
import Link from 'next/link';
import {
  Check,
  Shield,
  Star,
  TrendingUp,
  Users,
  Award,
  Lock,
  ChevronRight,
  Play,
  BarChart3,
  Target,
  Zap,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white relative overflow-hidden'>
      {/* Animated Background Effects */}
      <div className='absolute inset-0 overflow-hidden'>
        <div className='absolute -top-40 -right-40 w-80 h-80 bg-yellow-500/10 rounded-full blur-3xl animate-pulse'></div>
        <div className='absolute top-40 -left-40 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse delay-1000'></div>
        <div className='absolute bottom-40 right-20 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-2000'></div>
      </div>

      <div className='relative z-10'>
        {/* Auto-route component for handling post-sign-in routing */}
        <Suspense fallback={null}>
          <AutoRouteAfterSignIn />
        </Suspense>

        {/* Hero Banner */}
        <HeroBanner />

        {/* Trust Bar - Mobile-Optimized */}
        <div className='bg-gradient-to-r from-yellow-600/20 via-yellow-500/25 to-yellow-400/20 border-b border-yellow-400/30 backdrop-blur-sm'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6 py-2 sm:py-3'>
            <div className='flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm text-yellow-100'>
              <div className='flex items-center gap-1 sm:gap-2'>
                <Shield className='w-3 h-3 sm:w-4 sm:h-4' />
                <span className='whitespace-nowrap'>SEC Compliant</span>
              </div>
              <div className='flex items-center gap-1 sm:gap-2'>
                <Lock className='w-3 h-3 sm:w-4 sm:h-4' />
                <span className='whitespace-nowrap'>Bank-Level Security</span>
              </div>
              <div className='flex items-center gap-1 sm:gap-2'>
                <Award className='w-3 h-3 sm:w-4 sm:h-4' />
                <span className='whitespace-nowrap'>Secure Platform</span>
              </div>
            </div>
          </div>
        </div>

        {/* Shared Navigation */}
        <SharedNavbar currentPage='home' />

        {/* Hero Section - Mobile-Optimized */}
        <section
          id='hero'
          className='max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-12 sm:pb-16'
        >
          <div className='text-center mb-16'>
            {/* Social Proof Badge - Mobile-Optimized */}
            <div className='inline-flex items-center gap-2 bg-green-600/20 border border-green-400/30 rounded-full px-3 sm:px-4 py-2 mb-6 touch-manipulation'>
              <div className='flex -space-x-1 sm:-space-x-2'>
                <div className='w-5 h-5 sm:w-6 sm:h-6 bg-blue-500 rounded-full border-2 border-white'></div>
                <div className='w-5 h-5 sm:w-6 sm:h-6 bg-red-500 rounded-full border-2 border-white'></div>
                <div className='w-5 h-5 sm:w-6 sm:h-6 bg-purple-500 rounded-full border-2 border-white'></div>
              </div>
              <span className='text-green-400 text-xs sm:text-sm font-medium'>
                Trusted by 1,047+ professional traders
              </span>
            </div>

            {/* Main Headline - Mobile-First */}
            <h1 className='text-3xl sm:text-4xl md:text-6xl lg:text-7xl xl:text-8xl font-bold mb-6 leading-[0.9] tracking-tight px-4 sm:px-0'>
              <span className='bg-gradient-to-r from-white via-yellow-100 to-yellow-300 bg-clip-text text-transparent animate-gradient'>
                Turn Market Knowledge
              </span>
              <br />
              <span className='text-white drop-shadow-2xl'>
                Into Consistent
              </span>
              <br />
              <span className='bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 bg-clip-text text-transparent animate-gradient'>
                Profits
              </span>
            </h1>

            {/* Subheadline */}
            <p className='text-lg sm:text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed px-4 sm:px-0'>
              Join elite traders who receive{' '}
              <span className='text-yellow-400 font-semibold'>
                high-probability setups
              </span>
              , expert analysis, and live coaching sessions. Join our premium
              community today.
            </p>

            {/* Stats Row - Mobile-First Grid */}
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-12 max-w-4xl mx-auto'>
              <div className='flex flex-col items-center bg-gradient-to-b from-yellow-500/10 to-yellow-600/5 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-yellow-400/20 hover:border-yellow-400/40 transition-all duration-300 hover:transform hover:-translate-y-1 touch-manipulation'>
                <div className='text-2xl sm:text-3xl font-bold text-yellow-400'>
                  78%
                </div>
                <div className='text-xs sm:text-sm text-gray-300 text-center'>
                  Win Rate
                </div>
              </div>
              <div className='flex flex-col items-center bg-gradient-to-b from-green-500/10 to-green-600/5 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-green-400/20 hover:border-green-400/40 transition-all duration-300 hover:transform hover:-translate-y-1 touch-manipulation'>
                <div className='text-2xl sm:text-3xl font-bold text-green-400'>
                  $250K+
                </div>
                <div className='text-xs sm:text-sm text-gray-300 text-center'>
                  Member Profits
                </div>
              </div>
              <div className='flex flex-col items-center bg-gradient-to-b from-blue-500/10 to-blue-600/5 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-blue-400/20 hover:border-blue-400/40 transition-all duration-300 hover:transform hover:-translate-y-1 touch-manipulation'>
                <div className='text-2xl sm:text-3xl font-bold text-blue-400'>
                  1,047
                </div>
                <div className='text-xs sm:text-sm text-gray-300 text-center'>
                  Active Members
                </div>
              </div>
              <div className='flex flex-col items-center bg-gradient-to-b from-purple-500/10 to-purple-600/5 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-purple-400/20 hover:border-purple-400/40 transition-all duration-300 hover:transform hover:-translate-y-1 touch-manipulation'>
                <div className='text-2xl sm:text-3xl font-bold text-purple-400'>
                  2 Years
                </div>
                <div className='text-xs sm:text-sm text-gray-300 text-center'>
                  Track Record
                </div>
              </div>
            </div>

            {/* CTA Section */}
            <div className='flex flex-col items-center gap-4 mb-8'>
              <SmartEntryButton />
              <div className='flex items-center gap-2 text-green-400 text-sm'>
                <Check className='w-4 h-4' />
                <span>Premium access • Instant setup</span>
              </div>
            </div>
          </div>

          {/* Video Demo Section - Mobile-Optimized */}
          <div className='bg-gradient-to-br from-gray-800/60 via-slate-800/40 to-gray-900/60 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 mb-16 sm:mb-20 border border-gray-600/30 backdrop-blur-md shadow-2xl mx-4 sm:mx-0'>
            <div className='text-center mb-8 sm:mb-10'>
              <h2 className='text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent'>
                See TradersUtopia in Action
              </h2>
              <p className='text-gray-300 text-lg sm:text-xl'>
                Watch how our members receive and execute profitable trades
              </p>
            </div>
            <div className='relative max-w-5xl mx-auto'>
              <div className='aspect-video bg-gradient-to-br from-gray-900 to-black rounded-xl sm:rounded-2xl border border-gray-600/50 shadow-2xl relative overflow-hidden group hover:border-yellow-400/50 transition-all duration-500'>
                {/* YouTube Video Embed */}
                <iframe
                  className='w-full h-full rounded-xl sm:rounded-2xl'
                  src='https://www.youtube-nocookie.com/embed/YE7VzlLtp-4?autoplay=0&mute=0&controls=1&rel=0&modestbranding=1&showinfo=0&iv_load_policy=3&fs=1&cc_load_policy=0&wmode=transparent'
                  title='TradersUtopia Demo - See Our Platform in Action'
                  frameBorder='0'
                  allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
                  allowFullScreen
                  loading='lazy'
                  referrerPolicy='strict-origin-when-cross-origin'
                ></iframe>

                {/* Fallback for when video doesn't load */}
                <div
                  className='absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black rounded-xl sm:rounded-2xl'
                  style={{ zIndex: -1 }}
                >
                  <div className='text-center'>
                    <div className='w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4'>
                      <svg
                        className='w-8 h-8 text-red-400'
                        fill='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path d='M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z' />
                      </svg>
                    </div>
                    <h3 className='text-white font-semibold mb-2'>
                      Video Loading
                    </h3>
                    <p className='text-gray-400 text-sm'>
                      Click to watch on YouTube
                    </p>
                    <a
                      href='https://www.youtube.com/watch?v=dQw4w9WgXcQ'
                      target='_blank'
                      rel='noopener noreferrer'
                      className='mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors inline-block'
                    >
                      Watch on YouTube
                    </a>
                  </div>
                </div>
              </div>
              {/* Video Description */}
              <div className='text-center mt-4'>
                <p className='text-gray-400 text-sm'>
                  🎯 See how our platform delivers real-time trading signals and
                  market analysis
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section - Mobile-Optimized */}
        <section
          id='features'
          className='bg-gradient-to-b from-gray-900/50 to-black py-12 sm:py-16 md:py-20'
        >
          <div className='max-w-7xl mx-auto px-4 sm:px-6'>
            <div className='text-center mb-16'>
              <h2 className='text-4xl md:text-5xl font-bold mb-4'>
                Everything You Need to{' '}
                <span className='text-yellow-400'>Trade Profitably</span>
              </h2>
              <p className='text-xl text-gray-300 max-w-3xl mx-auto'>
                Our comprehensive platform provides real-time alerts, expert
                education, and a supportive community of successful traders.
              </p>
            </div>

            <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-8'>
              {/* Feature 1 */}
              <div className='group bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 hover:border-yellow-400/50 transition-all duration-500 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-yellow-400/10 backdrop-blur-sm'>
                <div className='w-16 h-16 bg-gradient-to-br from-yellow-500/20 to-yellow-600/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300'>
                  <TrendingUp className='w-8 h-8 text-yellow-400' />
                </div>
                <h3 className='text-2xl font-bold mb-4 group-hover:text-yellow-300 transition-colors'>
                  Real-Time Trade Alerts
                </h3>
                <p className='text-gray-300 mb-6 leading-relaxed'>
                  Receive instant notifications for high-probability setups with
                  entry, stop-loss, and target levels.
                </p>
                <div className='space-y-2'>
                  <div className='flex items-center gap-2 text-sm'>
                    <Check className='w-4 h-4 text-green-400' />
                    <span>SMS & Email alerts</span>
                  </div>
                  <div className='flex items-center gap-2 text-sm'>
                    <Check className='w-4 h-4 text-green-400' />
                    <span>Risk management included</span>
                  </div>
                  <div className='flex items-center gap-2 text-sm'>
                    <Check className='w-4 h-4 text-green-400' />
                    <span>Mobile app access</span>
                  </div>
                </div>
              </div>

              {/* Feature 2 */}
              <div className='group bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 hover:border-blue-400/50 transition-all duration-500 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-400/10 backdrop-blur-sm'>
                <div className='w-16 h-16 bg-gradient-to-br from-blue-500/20 to-blue-600/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300'>
                  <BarChart3 className='w-8 h-8 text-blue-400' />
                </div>
                <h3 className='text-2xl font-bold mb-4 group-hover:text-blue-300 transition-colors'>
                  Expert Market Analysis
                </h3>
                <p className='text-gray-300 mb-6 leading-relaxed'>
                  Daily market breakdowns, key level analysis, and economic
                  calendar insights from professional traders.
                </p>
                <div className='space-y-2'>
                  <div className='flex items-center gap-2 text-sm'>
                    <Check className='w-4 h-4 text-green-400' />
                    <span>Daily market reports</span>
                  </div>
                  <div className='flex items-center gap-2 text-sm'>
                    <Check className='w-4 h-4 text-green-400' />
                    <span>Video breakdowns</span>
                  </div>
                  <div className='flex items-center gap-2 text-sm'>
                    <Check className='w-4 h-4 text-green-400' />
                    <span>Economic calendar</span>
                  </div>
                </div>
              </div>

              {/* Feature 3 */}
              <div className='group bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 hover:border-purple-400/50 transition-all duration-500 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-purple-400/10 backdrop-blur-sm'>
                <div className='w-16 h-16 bg-gradient-to-br from-purple-500/20 to-purple-600/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300'>
                  <Users className='w-8 h-8 text-purple-400' />
                </div>
                <h3 className='text-2xl font-bold mb-4 group-hover:text-purple-300 transition-colors'>
                  Live Trading Sessions
                </h3>
                <p className='text-gray-300 mb-6 leading-relaxed'>
                  Join live sessions where experts explain their thought process
                  and trade in real-time.
                </p>
                <div className='space-y-2'>
                  <div className='flex items-center gap-2 text-sm'>
                    <Check className='w-4 h-4 text-green-400' />
                    <span>3x weekly sessions</span>
                  </div>
                  <div className='flex items-center gap-2 text-sm'>
                    <Check className='w-4 h-4 text-green-400' />
                    <span>Q&A opportunities</span>
                  </div>
                  <div className='flex items-center gap-2 text-sm'>
                    <Check className='w-4 h-4 text-green-400' />
                    <span>Session recordings</span>
                  </div>
                </div>
              </div>

              {/* Feature 4 */}
              <div className='group bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 hover:border-green-400/50 transition-all duration-500 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-green-400/10 backdrop-blur-sm'>
                <div className='w-16 h-16 bg-gradient-to-br from-green-500/20 to-green-600/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300'>
                  <Target className='w-8 h-8 text-green-400' />
                </div>
                <h3 className='text-2xl font-bold mb-4 group-hover:text-green-300 transition-colors'>
                  Risk Management Tools
                </h3>
                <p className='text-gray-300 mb-6 leading-relaxed'>
                  Advanced position sizing calculators and risk management
                  strategies to protect your capital.
                </p>
                <div className='space-y-2'>
                  <div className='flex items-center gap-2 text-sm'>
                    <Check className='w-4 h-4 text-green-400' />
                    <span>Position size calculator</span>
                  </div>
                  <div className='flex items-center gap-2 text-sm'>
                    <Check className='w-4 h-4 text-green-400' />
                    <span>Stop-loss strategies</span>
                  </div>
                  <div className='flex items-center gap-2 text-sm'>
                    <Check className='w-4 h-4 text-green-400' />
                    <span>Portfolio tracking</span>
                  </div>
                </div>
              </div>

              {/* Feature 5 */}
              <div className='group bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 hover:border-red-400/50 transition-all duration-500 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-red-400/10 backdrop-blur-sm'>
                <div className='w-16 h-16 bg-gradient-to-br from-red-500/20 to-red-600/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300'>
                  <Zap className='w-8 h-8 text-red-400' />
                </div>
                <h3 className='text-2xl font-bold mb-4 group-hover:text-red-300 transition-colors'>
                  Premium Community
                </h3>
                <p className='text-gray-300 mb-6 leading-relaxed'>
                  Connect with successful traders, share strategies, and get
                  feedback on your trades.
                </p>
                <div className='space-y-2'>
                  <div className='flex items-center gap-2 text-sm'>
                    <Check className='w-4 h-4 text-green-400' />
                    <span>Private Discord server</span>
                  </div>
                  <div className='flex items-center gap-2 text-sm'>
                    <Check className='w-4 h-4 text-green-400' />
                    <span>Trade review sessions</span>
                  </div>
                  <div className='flex items-center gap-2 text-sm'>
                    <Check className='w-4 h-4 text-green-400' />
                    <span>Mentorship program</span>
                  </div>
                </div>
              </div>

              {/* Feature 6 */}
              <div className='group bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 hover:border-orange-400/50 transition-all duration-500 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-orange-400/10 backdrop-blur-sm'>
                <div className='w-16 h-16 bg-gradient-to-br from-orange-500/20 to-orange-600/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300'>
                  <Award className='w-8 h-8 text-orange-400' />
                </div>
                <h3 className='text-2xl font-bold mb-4 group-hover:text-orange-300 transition-colors'>
                  Educational Resources
                </h3>
                <p className='text-gray-300 mb-6 leading-relaxed'>
                  Comprehensive trading courses, webinars, and resources for all
                  skill levels.
                </p>
                <div className='space-y-2'>
                  <div className='flex items-center gap-2 text-sm'>
                    <Check className='w-4 h-4 text-green-400' />
                    <span>50+ hours of content</span>
                  </div>
                  <div className='flex items-center gap-2 text-sm'>
                    <Check className='w-4 h-4 text-green-400' />
                    <span>Interactive quizzes</span>
                  </div>
                  <div className='flex items-center gap-2 text-sm'>
                    <Check className='w-4 h-4 text-green-400' />
                    <span>Certification program</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Free Videos Section - Mobile-Optimized */}
        <section id='free-videos' className='py-12 sm:py-16 md:py-20'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6'>
            <div className='text-center mb-12 sm:mb-16'>
              <h2 className='text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6'>
                Start Learning for{' '}
                <span className='bg-gradient-to-r from-green-400 via-blue-500 to-purple-600 bg-clip-text text-transparent'>
                  FREE
                </span>
              </h2>
              <p className='text-lg sm:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed'>
                Get instant access to our premium educational content and see
                why thousands of traders trust TradersUtopia
              </p>
            </div>

            <div className='bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 border border-gray-600/30 backdrop-blur-md shadow-2xl mx-4 sm:mx-0 mb-8 sm:mb-12'>
              <div className='grid lg:grid-cols-2 gap-8 lg:gap-12 items-center'>
                {/* Left Side - Content */}
                <div className='space-y-6'>
                  <div className='flex items-center gap-3 mb-4'>
                    <div className='w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-green-500/20 to-blue-600/30 rounded-xl sm:rounded-2xl flex items-center justify-center'>
                      <Play className='w-6 h-6 sm:w-8 sm:h-8 text-green-400' />
                    </div>
                    <div>
                      <h3 className='text-xl sm:text-2xl md:text-3xl font-bold text-white'>
                        Free Trading Education
                      </h3>
                      <p className='text-green-400 text-sm sm:text-base font-medium'>
                        No subscription required
                      </p>
                    </div>
                  </div>

                  <div className='space-y-4'>
                    <div className='flex items-start gap-3'>
                      <div className='w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1'>
                        <Check className='w-3 h-3 text-green-400' />
                      </div>
                      <div>
                        <h4 className='text-white font-semibold mb-1'>
                          Professional Trading Strategies
                        </h4>
                        <p className='text-gray-300 text-sm'>
                          Learn the exact methods our premium members use to
                          generate consistent profits
                        </p>
                      </div>
                    </div>

                    <div className='flex items-start gap-3'>
                      <div className='w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1'>
                        <Check className='w-3 h-3 text-blue-400' />
                      </div>
                      <div>
                        <h4 className='text-white font-semibold mb-1'>
                          Risk Management Fundamentals
                        </h4>
                        <p className='text-gray-300 text-sm'>
                          Master the art of protecting your capital while
                          maximizing returns
                        </p>
                      </div>
                    </div>

                    <div className='flex items-start gap-3'>
                      <div className='w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1'>
                        <Check className='w-3 h-3 text-purple-400' />
                      </div>
                      <div>
                        <h4 className='text-white font-semibold mb-1'>
                          Market Analysis Techniques
                        </h4>
                        <p className='text-gray-300 text-sm'>
                          Discover how to read charts and identify
                          high-probability setups
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className='pt-4'>
                    <Link
                      href='/free-videos'
                      className='inline-flex items-center gap-3 bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 hover:from-green-500 hover:via-blue-500 hover:to-purple-500 text-white font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 touch-manipulation'
                    >
                      <Play className='w-5 h-5 sm:w-6 sm:h-6' />
                      <span className='text-sm sm:text-base'>
                        Watch Free Videos
                      </span>
                      <ChevronRight className='w-4 h-4 sm:w-5 sm:h-5' />
                    </Link>
                  </div>
                </div>

                {/* Right Side - Video Preview */}
                <div className='relative'>
                  <div className='aspect-video bg-gradient-to-br from-gray-900 to-black rounded-xl sm:rounded-2xl border border-gray-600/50 shadow-2xl overflow-hidden group hover:border-blue-400/50 transition-all duration-500 relative'>
                    {/* YouTube Video Embed for Free Videos Preview */}
                    <iframe
                      className='w-full h-full rounded-xl sm:rounded-2xl'
                      src='https://www.youtube-nocookie.com/embed/eRsGyueVLvQ?autoplay=0&mute=0&controls=1&rel=0&modestbranding=1&showinfo=0&iv_load_policy=3&fs=1&cc_load_policy=0&wmode=transparent'
                      title='TradersUtopia Free Trading Education Preview'
                      frameBorder='0'
                      allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
                      allowFullScreen
                      loading='lazy'
                      referrerPolicy='strict-origin-when-cross-origin'
                    ></iframe>

                    {/* Fallback for when video doesn't load */}
                    <div
                      className='absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black rounded-xl sm:rounded-2xl'
                      style={{ zIndex: -1 }}
                    >
                      <div className='text-center'>
                        <div className='w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4'>
                          <svg
                            className='w-8 h-8 text-red-400'
                            fill='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path d='M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z' />
                          </svg>
                        </div>
                        <h3 className='text-white font-semibold mb-2'>
                          Video Loading
                        </h3>
                        <p className='text-gray-400 text-sm'>
                          Click to watch on YouTube
                        </p>
                        <a
                          href='https://www.youtube.com/watch?v=jNQXAC9IVRw'
                          target='_blank'
                          rel='noopener noreferrer'
                          className='mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors inline-block'
                        >
                          Watch on YouTube
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Floating stats */}
                  <div className='absolute -top-4 -right-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-full shadow-lg'>
                    🔥 Free Access
                  </div>

                  {/* Video Description */}
                  <div className='mt-4 text-center'>
                    <p className='text-gray-400 text-xs sm:text-sm'>
                      🎯 Preview: Professional Trading Education • Free Access
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Video Stats Grid */}
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-4xl mx-auto'>
              <div className='bg-gradient-to-b from-green-500/10 to-green-600/5 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-green-400/20 text-center'>
                <div className='text-xl sm:text-2xl font-bold text-green-400 mb-1'>
                  25+
                </div>
                <div className='text-xs sm:text-sm text-gray-300'>
                  Free Videos
                </div>
              </div>
              <div className='bg-gradient-to-b from-blue-500/10 to-blue-600/5 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-blue-400/20 text-center'>
                <div className='text-xl sm:text-2xl font-bold text-blue-400 mb-1'>
                  15+
                </div>
                <div className='text-xs sm:text-sm text-gray-300'>
                  Hours Content
                </div>
              </div>
              <div className='bg-gradient-to-b from-purple-500/10 to-purple-600/5 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-purple-400/20 text-center'>
                <div className='text-xl sm:text-2xl font-bold text-purple-400 mb-1'>
                  4.8★
                </div>
                <div className='text-xs sm:text-sm text-gray-300'>
                  Average Rating
                </div>
              </div>
              <div className='bg-gradient-to-b from-yellow-500/10 to-yellow-600/5 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-yellow-400/20 text-center'>
                <div className='text-xl sm:text-2xl font-bold text-yellow-400 mb-1'>
                  100%
                </div>
                <div className='text-xs sm:text-sm text-gray-300'>
                  Free Access
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Results Section - Live Track Record */}
        <section id='results' className='py-20'>
          <div className='max-w-7xl mx-auto px-6'>
            <div className='text-center mb-16'>
              <h2 className='text-4xl md:text-5xl font-bold mb-4'>
                Live Track Record & Results From{' '}
                <span className='text-yellow-400'>Real Traders</span>
              </h2>
              <p className='text-xl text-gray-300 max-w-3xl mx-auto mb-8'>
                See our transparent trading performance and real-time updates
                from our professional traders. Every trade, win or loss,
                documented with complete transparency.
              </p>

              {/* Live indicators */}
              <div className='flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-gray-400 mb-12'>
                <div className='flex items-center gap-2'>
                  <div className='w-3 h-3 bg-green-500 rounded-full animate-pulse'></div>
                  <span>Live Updates</span>
                </div>
                <div className='hidden sm:block w-1 h-1 bg-gray-500 rounded-full'></div>
                <div className='flex items-center gap-2'>
                  <div className='w-3 h-3 bg-blue-500 rounded-full'></div>
                  <span>100% Transparent</span>
                </div>
                <div className='hidden sm:block w-1 h-1 bg-gray-500 rounded-full'></div>
                <div className='flex items-center gap-2'>
                  <div className='w-3 h-3 bg-purple-500 rounded-full'></div>
                  <span>Verified Traders</span>
                </div>
              </div>
            </div>

            {/* Performance Stats */}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-12'>
              <div className='bg-gradient-to-br from-green-500/10 to-emerald-600/5 rounded-2xl lg:rounded-3xl p-6 lg:p-8 border border-green-400/20 backdrop-blur-sm hover:border-green-400/30 transition-all duration-300 hover:scale-105'>
                <div className='flex items-center gap-4 mb-4'>
                  <div className='w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center'>
                    <span className='text-2xl'>📈</span>
                  </div>
                  <div>
                    <h3 className='text-lg font-semibold text-white'>
                      Win Rate
                    </h3>
                    <p className='text-green-400 text-3xl font-bold'>78.5%</p>
                  </div>
                </div>
                <p className='text-sm text-gray-300 leading-relaxed'>
                  Consistent profitability across all trading strategies with
                  disciplined risk management
                </p>
              </div>

              <div className='bg-gradient-to-br from-blue-500/10 to-cyan-600/5 rounded-2xl lg:rounded-3xl p-6 lg:p-8 border border-blue-400/20 backdrop-blur-sm hover:border-blue-400/30 transition-all duration-300 hover:scale-105'>
                <div className='flex items-center gap-4 mb-4'>
                  <div className='w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center'>
                    <span className='text-2xl'>💰</span>
                  </div>
                  <div>
                    <h3 className='text-lg font-semibold text-white'>
                      Monthly ROI
                    </h3>
                    <p className='text-blue-400 text-3xl font-bold'>12.3%</p>
                  </div>
                </div>
                <p className='text-sm text-gray-300 leading-relaxed'>
                  Steady monthly returns with compound growth and capital
                  preservation focus
                </p>
              </div>

              <div className='bg-gradient-to-br from-purple-500/10 to-violet-600/5 rounded-2xl lg:rounded-3xl p-6 lg:p-8 border border-purple-400/20 backdrop-blur-sm hover:border-purple-400/30 transition-all duration-300 hover:scale-105'>
                <div className='flex items-center gap-4 mb-4'>
                  <div className='w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center'>
                    <span className='text-2xl'>🛡️</span>
                  </div>
                  <div>
                    <h3 className='text-lg font-semibold text-white'>
                      Max Drawdown
                    </h3>
                    <p className='text-purple-400 text-3xl font-bold'>-4.2%</p>
                  </div>
                </div>
                <p className='text-sm text-gray-300 leading-relaxed'>
                  Excellent risk management with minimal capital exposure and
                  quick recovery
                </p>
              </div>
            </div>

            {/* Live Track Record Chat */}
            <div className='bg-gray-900/50 backdrop-blur-xl rounded-2xl lg:rounded-3xl border border-gray-700/50 shadow-2xl shadow-black/20 overflow-hidden mb-8'>
              <TrackRecordMinimal />
            </div>

            {/* Call to Action */}
            <div className='text-center'>
              <div className='inline-flex flex-col sm:flex-row items-center gap-4'>
                <Link
                  href='/track-record'
                  className='inline-flex items-center gap-3 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 hover:from-purple-500 hover:via-blue-500 hover:to-cyan-500 text-white font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 touch-manipulation group'
                >
                  <BarChart3 className='w-5 h-5 sm:w-6 sm:h-6 group-hover:animate-pulse' />
                  <span className='text-sm sm:text-base'>
                    View Full Track Record
                  </span>
                  <ChevronRight className='w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform' />
                </Link>
                <div className='flex items-center gap-2 text-purple-400 text-sm'>
                  <Award className='w-4 h-4' />
                  <span>Real performance • No hidden results</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section
          id='testimonials'
          className='bg-gradient-to-b from-gray-900/50 to-black py-20'
        >
          <div className='max-w-7xl mx-auto px-6'>
            <div className='text-center mb-16'>
              <h2 className='text-4xl md:text-5xl font-bold mb-4'>
                What Our <span className='text-yellow-400'>Members Say</span>
              </h2>
            </div>

            <div className='grid md:grid-cols-3 gap-8'>
              {/* Testimonial 1 */}
              <div className='bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 hover:border-blue-400/50 transition-all duration-500 hover:transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-400/10 backdrop-blur-sm'>
                <div className='flex items-center gap-1 mb-4'>
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className='w-4 h-4 text-yellow-400 fill-current'
                    />
                  ))}
                </div>
                <p className='text-gray-300 mb-4 italic'>
                  "I've been trading for 3 years and TradersUtopia completely
                  changed my approach. The alerts are incredibly accurate and
                  the education is top-notch."
                </p>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold'>
                    M
                  </div>
                  <div>
                    <div className='font-semibold'>Marcus Chen</div>
                    <div className='text-sm text-gray-400'>
                      Software Engineer, +$47K profit
                    </div>
                  </div>
                </div>
              </div>

              {/* Testimonial 2 */}
              <div className='bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 hover:border-purple-400/50 transition-all duration-500 hover:transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-400/10 backdrop-blur-sm'>
                <div className='flex items-center gap-1 mb-4'>
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className='w-4 h-4 text-yellow-400 fill-current'
                    />
                  ))}
                </div>
                <p className='text-gray-300 mb-4 italic'>
                  "The live sessions are incredible. Being able to watch
                  professionals trade in real-time and explain their thinking is
                  invaluable."
                </p>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold'>
                    S
                  </div>
                  <div>
                    <div className='font-semibold'>Sarah Johnson</div>
                    <div className='text-sm text-gray-400'>
                      Marketing Director, +$23K profit
                    </div>
                  </div>
                </div>
              </div>

              {/* Testimonial 3 */}
              <div className='bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 hover:border-green-400/50 transition-all duration-500 hover:transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-green-400/10 backdrop-blur-sm'>
                <div className='flex items-center gap-1 mb-4'>
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className='w-4 h-4 text-yellow-400 fill-current'
                    />
                  ))}
                </div>
                <p className='text-gray-300 mb-4 italic'>
                  "Best investment I've made. The risk management strategies
                  alone have saved me thousands. Highly recommend to any serious
                  trader."
                </p>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold'>
                    D
                  </div>
                  <div>
                    <div className='font-semibold'>David Rodriguez</div>
                    <div className='text-sm text-gray-400'>
                      Financial Advisor, +$89K profit
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Guarantee Section */}
        <section id='guarantee' className='py-20'>
          <div className='max-w-4xl mx-auto px-6 text-center'>
            <div className='bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-400/30 rounded-2xl p-8'>
              <div className='w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6'>
                <Shield className='w-8 h-8 text-green-400' />
              </div>
              <h2 className='text-3xl font-bold mb-4'>Our Commitment to You</h2>
              <p className='text-xl text-gray-300 mb-6'>
                Join TradersUtopia and access our proven trading strategies and
                professional alerts.
              </p>
              <div className='flex flex-wrap justify-center gap-6 text-sm'>
                <div className='flex items-center gap-2'>
                  <Check className='w-4 h-4 text-green-400' />
                  <span>Instant access</span>
                </div>
                <div className='flex items-center gap-2'>
                  <Check className='w-4 h-4 text-green-400' />
                  <span>Professional alerts</span>
                </div>
                <div className='flex items-center gap-2'>
                  <Check className='w-4 h-4 text-green-400' />
                  <span>Cancel anytime</span>
                </div>
                <div className='flex items-center gap-2'>
                  <Check className='w-4 h-4 text-green-400' />
                  <span>Premium support</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section
          id='pricing'
          className='bg-gradient-to-b from-gray-900/50 to-black py-20'
        >
          <div className='max-w-4xl mx-auto px-6 text-center'>
            <h2 className='text-4xl md:text-5xl font-bold mb-6'>
              Start Your{' '}
              <span className='text-yellow-400'>Trading Journey</span> Today
            </h2>
            <p className='text-xl text-gray-300 mb-8'>
              Join 1,047+ successful traders and start receiving profitable
              trade alerts within minutes.
            </p>

            {/* Pricing */}
            <div className='bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-3xl p-10 border border-gray-700/50 mb-8 backdrop-blur-md shadow-2xl hover:border-yellow-400/50 transition-all duration-500'>
              <div className='flex items-center justify-center gap-2 mb-4'>
                <span className='text-gray-400 text-lg line-through'>
                  $199/month
                </span>
                <span className='bg-red-500 text-white text-xs px-2 py-1 rounded-full'>
                  SAVE $50
                </span>
              </div>
              <div className='text-5xl font-bold text-yellow-400 mb-2'>
                $149
              </div>
              <div className='text-gray-300 mb-6'>
                per month • Premium access
              </div>

              <div className='space-y-4 mb-8'>
                <Link href='/pricing'>
                  <Button
                    size='lg'
                    className='bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 hover:from-blue-700 hover:via-purple-700 hover:to-indigo-800 text-white px-6 sm:px-8 md:px-12 py-4 sm:py-5 md:py-6 text-base sm:text-lg md:text-xl font-bold rounded-xl transition-all duration-300 transform hover:scale-105 shadow-2xl border border-blue-400/30 hover:border-purple-400/50 hover:shadow-purple-500/25 w-full sm:w-auto touch-manipulation min-h-[48px] sm:min-h-[52px] md:min-h-[56px]'
                  >
                    <div className='flex items-center gap-2'>
                      <span className='text-lg sm:text-xl animate-pulse'>
                        💰
                      </span>
                      <span className='text-sm sm:text-base md:text-lg bg-gradient-to-r from-white to-gray-100 bg-clip-text text-transparent'>
                        💎 View Pricing
                      </span>
                      <ChevronRight className='h-3 w-3 sm:h-4 sm:w-4 text-yellow-300 animate-bounce' />
                    </div>
                  </Button>
                </Link>
                <p className='text-green-400 text-sm'>
                  ✅ Explore our pricing options and get started
                </p>
              </div>

              <div className='grid md:grid-cols-2 gap-4 text-left'>
                <div className='flex items-center gap-2'>
                  <Check className='w-4 h-4 text-green-400 flex-shrink-0' />
                  <span className='text-sm'>Real-time trade alerts</span>
                </div>
                <div className='flex items-center gap-2'>
                  <Check className='w-4 h-4 text-green-400 flex-shrink-0' />
                  <span className='text-sm'>Live trading sessions</span>
                </div>
                <div className='flex items-center gap-2'>
                  <Check className='w-4 h-4 text-green-400 flex-shrink-0' />
                  <span className='text-sm'>Expert market analysis</span>
                </div>
                <div className='flex items-center gap-2'>
                  <Check className='w-4 h-4 text-green-400 flex-shrink-0' />
                  <span className='text-sm'>Premium community access</span>
                </div>
                <div className='flex items-center gap-2'>
                  <Check className='w-4 h-4 text-green-400 flex-shrink-0' />
                  <span className='text-sm'>Risk management tools</span>
                </div>
                <div className='flex items-center gap-2'>
                  <Check className='w-4 h-4 text-green-400 flex-shrink-0' />
                  <span className='text-sm'>Educational resources</span>
                </div>
              </div>
            </div>

            <p className='text-gray-400 text-sm'>
              Over 1,047 members • 4.9/5 rating • Join risk-free today
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className='border-t border-gray-800 py-12'>
          <div className='max-w-7xl mx-auto px-6'>
            <div className='grid md:grid-cols-4 gap-8'>
              <div>
                <div className='flex items-center gap-3 mb-4'>
                  <div className='w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center'>
                    <NextImage
                      src='/logo.png'
                      alt='TradersUtopia'
                      width={20}
                      height={20}
                    />
                  </div>
                  <span className='text-white font-bold'>TradersUtopia</span>
                </div>
                <p className='text-gray-400 text-sm'>
                  Professional trading signals and education platform trusted by
                  thousands of traders worldwide.
                </p>
              </div>

              <div>
                <h4 className='text-white font-semibold mb-3'>Product</h4>
                <div className='space-y-2 text-sm'>
                  <Link
                    href='#features'
                    className='text-gray-400 hover:text-white block'
                  >
                    Features
                  </Link>
                  <Link
                    href='#pricing'
                    className='text-gray-400 hover:text-white block'
                  >
                    Pricing
                  </Link>
                  <Link
                    href='/dashboard'
                    className='text-gray-400 hover:text-white block'
                  >
                    Dashboard
                  </Link>
                </div>
              </div>

              <div>
                <h4 className='text-white font-semibold mb-3'>Support</h4>
                <div className='space-y-2 text-sm'>
                  <Link
                    href='/support'
                    className='text-gray-400 hover:text-white block'
                  >
                    Help Center
                  </Link>
                  <Link
                    href='/support'
                    className='text-gray-400 hover:text-white block'
                  >
                    Contact Us
                  </Link>
                  <Link
                    href='/terms-of-service'
                    className='text-gray-400 hover:text-white block'
                  >
                    Terms of Service
                  </Link>
                </div>
              </div>

              <div>
                <h4 className='text-white font-semibold mb-3'>Legal</h4>
                <div className='space-y-2 text-sm'>
                  <Link
                    href='/privacy-policy'
                    className='text-gray-400 hover:text-white block'
                  >
                    Privacy Policy
                  </Link>
                  <Link
                    href='/terms-of-service#risk-disclosure'
                    className='text-gray-400 hover:text-white block'
                  >
                    Risk Disclosure
                  </Link>
                  <Link
                    href='/terms-of-service#risk-disclosure'
                    className='text-gray-400 hover:text-white block'
                  >
                    SEC Compliance
                  </Link>
                </div>
              </div>
            </div>

            <div className='border-t border-gray-800 pt-8 mt-8 text-center'>
              <p className='text-gray-400 text-sm'>
                © 2024 TradersUtopia. All rights reserved. Trading involves
                risk and may not be suitable for all investors.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
