import { TrackRecordMinimal } from '@/components/track-record/track-record-minimal';
import { TrackRecordStandalone } from '@/components/track-record/track-record-standalone';
import { TrackRecordStatic } from '@/components/track-record/track-record-static';
import { SharedNavbar } from '@/components/shared-navbar';

// Set to true to use static version (no infinite loops)
const USE_STATIC_VERSION = false; // 🔄 TESTING: Ultra-minimal version
const USE_STANDALONE_VERSION = false; // ❌ FAILED: Still triggering Zustand somehow
const USE_MINIMAL_VERSION = true; // ✅ NEW: Ultra-minimal with zero external dependencies

export default function TrackRecordPage() {
  return (
    <div className='min-h-screen bg-gradient-to-br from-gray-900 via-gray-800/90 to-gray-900/95 text-white pwa-layout safe-min-height'>
      <div className='pwa-safe-top pwa-safe-bottom safe-area-inset-left safe-area-inset-right'>
        {/* Shared Navigation */}
        <SharedNavbar currentPage='track-record' />

        {/* Main Content with Enhanced PWA Support */}
        <main className='relative safe-area-inset-top pwa-safe-bottom'>
          {/* Header Section */}
          <div className='relative pt-8 pb-12 px-4 sm:px-6 lg:px-8 pwa-safe-top'>
            {/* Background Pattern */}
            <div className='absolute inset-0 overflow-hidden'>
              <div className='absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl' />
              <div className='absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl' />
              <div className='absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-purple-500/5 to-blue-500/5 rounded-full blur-3xl' />
            </div>

            <div className='relative max-w-6xl mx-auto text-center'>
              <div className='flex items-center justify-center mb-6'>
                <div className='w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-purple-500/20'>
                  <span className='text-2xl'>📊</span>
                </div>
              </div>

              <h1 className='text-4xl md:text-6xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent mb-6'>
                Live Track Record
              </h1>

              <p className='text-lg md:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed'>
                Complete transparency in our trading performance. Every trade,
                win or loss, documented in real-time for your review. Our
                professional traders share their insights and results here.
              </p>

              <div className='mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-gray-400'>
                <div className='flex items-center gap-2'>
                  <div className='w-3 h-3 bg-green-500 rounded-full animate-pulse'></div>
                  <span>Live Updates</span>
                </div>
                <div className='hidden sm:block w-1 h-1 bg-gray-500 rounded-full'></div>
                <div className='flex items-center gap-2'>
                  <div className='w-3 h-3 bg-red-500 rounded-full'></div>
                  <span>Admin Verified</span>
                </div>
                <div className='hidden sm:block w-1 h-1 bg-gray-500 rounded-full'></div>
                <div className='flex items-center gap-2'>
                  <div className='w-3 h-3 bg-blue-500 rounded-full'></div>
                  <span>100% Transparent</span>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Stats */}
          <div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mb-12'>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8'>
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
          </div>

          {/* Track Record Chat */}
          <div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16'>
            <div className='bg-gray-900/50 backdrop-blur-xl rounded-2xl lg:rounded-3xl border border-gray-700/50 shadow-2xl shadow-black/20 overflow-hidden'>
              {USE_MINIMAL_VERSION ? (
                <TrackRecordMinimal />
              ) : USE_STANDALONE_VERSION ? (
                <TrackRecordStandalone />
              ) : USE_STATIC_VERSION ? (
                <TrackRecordStatic />
              ) : (
                <TrackRecordStatic />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
