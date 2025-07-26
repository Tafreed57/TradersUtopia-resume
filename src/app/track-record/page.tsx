import { Button } from '@/components/ui/button';
import { SharedNavbar } from '@/components/shared-navbar';
import { TrackRecordMinimal } from '@/components/track-record/track-record-minimal';
import { Suspense } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  TrendingUp,
  Shield,
  Award,
  BarChart3,
  Loader2,
} from 'lucide-react';

export default function TrackRecordPage() {
  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white relative overflow-hidden'>
      {/* Animated Background Effects */}
      <div className='absolute inset-0 overflow-hidden'>
        <div className='absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse'></div>
        <div className='absolute top-40 -left-40 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse delay-1000'></div>
        <div className='absolute bottom-40 right-20 w-64 h-64 bg-green-500/5 rounded-full blur-3xl animate-pulse delay-2000'></div>
      </div>

      <div className='relative z-10'>
        {/* Navigation */}
        <SharedNavbar currentPage='track-record' />

        {/* Page Header */}
        <div className='max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-8'>
          {/* Back Navigation */}
          <div className='mb-6'>
            <Link
              href='/'
              className='inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors group'
            >
              <ArrowLeft className='w-4 h-4 group-hover:-translate-x-1 transition-transform' />
              <span className='text-sm'>Back to Home</span>
            </Link>
          </div>

          {/* Header Content */}
          <div className='text-center mb-8'>
            <div className='inline-flex items-center gap-3 bg-gradient-to-r from-purple-600/20 via-blue-600/20 to-cyan-600/20 border border-purple-400/30 rounded-full px-4 py-2 mb-6'>
              <div className='w-3 h-3 bg-green-500 rounded-full animate-pulse'></div>
              <span className='text-purple-300 text-sm font-medium'>
                Live Trading Performance
              </span>
            </div>

            <h1 className='text-4xl sm:text-5xl md:text-6xl font-bold mb-4 leading-tight'>
              <span className='bg-gradient-to-r from-white via-purple-100 to-cyan-300 bg-clip-text text-transparent'>
                Complete Track Record
              </span>
            </h1>

            <p className='text-lg sm:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed mb-8'>
              Real-time trading updates from our professional traders. Every
              trade, win or loss, documented with complete transparency and
              verified performance.
            </p>

            {/* Trust Indicators */}
            <div className='flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400 mb-8'>
              <div className='flex items-center gap-2'>
                <Shield className='w-4 h-4 text-green-400' />
                <span>100% Transparent</span>
              </div>
              <div className='flex items-center gap-2'>
                <BarChart3 className='w-4 h-4 text-blue-400' />
                <span>Real-Time Updates</span>
              </div>
              <div className='flex items-center gap-2'>
                <Award className='w-4 h-4 text-purple-400' />
                <span>Verified Performance</span>
              </div>
            </div>
          </div>

          {/* Performance Stats Grid */}
          <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 max-w-4xl mx-auto'>
            <div className='bg-gradient-to-br from-green-500/10 to-emerald-600/5 rounded-2xl p-6 border border-green-400/20 backdrop-blur-sm hover:border-green-400/30 transition-all duration-300 hover:scale-105'>
              <div className='flex items-center gap-4 mb-4'>
                <div className='w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center'>
                  <TrendingUp className='w-6 h-6 text-green-400' />
                </div>
                <div>
                  <h3 className='text-lg font-semibold text-white'>Win Rate</h3>
                  <p className='text-green-400 text-3xl font-bold'>78.5%</p>
                </div>
              </div>
              <p className='text-sm text-gray-300'>
                Consistent profitability across all strategies
              </p>
            </div>

            <div className='bg-gradient-to-br from-blue-500/10 to-cyan-600/5 rounded-2xl p-6 border border-blue-400/20 backdrop-blur-sm hover:border-blue-400/30 transition-all duration-300 hover:scale-105'>
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
              <p className='text-sm text-gray-300'>
                Steady returns with compound growth
              </p>
            </div>

            <div className='bg-gradient-to-br from-purple-500/10 to-violet-600/5 rounded-2xl p-6 border border-purple-400/20 backdrop-blur-sm hover:border-purple-400/30 transition-all duration-300 hover:scale-105'>
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
              <p className='text-sm text-gray-300'>Excellent risk management</p>
            </div>
          </div>
        </div>

        {/* Track Record Component - Full Screen */}
        <div className='max-w-7xl mx-auto px-4 sm:px-6 pb-8'>
          <div className='bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 shadow-2xl shadow-black/20 overflow-hidden'>
            <Suspense
              fallback={
                <div className='flex flex-col h-[800px] items-center justify-center'>
                  <div className='flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-600/20 border border-purple-400/30 backdrop-blur-sm mb-4'>
                    <Loader2 className='h-8 w-8 text-purple-400 animate-spin' />
                  </div>
                  <p className='text-sm text-gray-300'>
                    Loading track record...
                  </p>
                </div>
              }
            >
              <div className='min-h-[800px]'>
                <TrackRecordMinimal />
              </div>
            </Suspense>
          </div>
        </div>

        {/* Call to Action Section */}
        <div className='max-w-4xl mx-auto px-4 sm:px-6 pb-12'>
          <div className='bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 backdrop-blur-md text-center'>
            <h2 className='text-2xl sm:text-3xl font-bold mb-4'>
              Ready to Start Trading with{' '}
              <span className='text-yellow-400'>Professional Alerts</span>?
            </h2>
            <p className='text-gray-300 mb-6 leading-relaxed'>
              Join our community of successful traders and start receiving
              real-time alerts from the same professional traders you see in our
              track record.
            </p>
            <div className='flex flex-col sm:flex-row items-center justify-center gap-4'>
              <Link href='/pricing'>
                <Button
                  size='lg'
                  className='bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 hover:from-purple-500 hover:via-blue-500 hover:to-cyan-500 text-white px-8 py-4 text-lg font-semibold rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 w-full sm:w-auto'
                >
                  View Pricing Plans
                </Button>
              </Link>
              <Link href='/free-videos'>
                <Button
                  variant='outline'
                  size='lg'
                  className='border-gray-600 text-gray-300 hover:text-white hover:border-gray-500 px-8 py-4 text-lg rounded-xl transition-all duration-300 w-full sm:w-auto'
                >
                  Watch Free Videos
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
