'use client';

import { BarChart3, TrendingUp, Shield, Award } from 'lucide-react';

export function TrackRecordWelcome() {
  return (
    <div className='space-y-4 px-4 mb-4'>
      <div className='flex items-center justify-center mb-6'>
        <div className='w-16 h-16 bg-gradient-to-br from-purple-500/20 to-blue-600/20 rounded-2xl flex items-center justify-center'>
          <BarChart3 className='w-8 h-8 text-purple-400' />
        </div>
      </div>

      <div className='text-center space-y-2'>
        <h3 className='text-xl font-bold text-white'>
          Welcome to Our Track Record
        </h3>
        <p className='text-gray-300 text-sm sm:text-base'>
          This is where our professional traders share real-time updates about
          their trading performance. Every trade, win or loss, is documented
          here with complete transparency.
        </p>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6'>
        <div className='bg-gradient-to-br from-green-500/10 to-green-600/5 rounded-xl p-4 border border-green-400/20'>
          <div className='flex items-center gap-3 mb-2'>
            <TrendingUp className='w-5 h-5 text-green-400' />
            <span className='text-white font-medium'>Winning Trades</span>
          </div>
          <p className='text-sm text-gray-300'>
            Detailed analysis of successful trades with entry, exit, and profit
            details
          </p>
        </div>

        <div className='bg-gradient-to-br from-red-500/10 to-red-600/5 rounded-xl p-4 border border-red-400/20'>
          <div className='flex items-center gap-3 mb-2'>
            <Shield className='w-5 h-5 text-red-400' />
            <span className='text-white font-medium'>Risk Management</span>
          </div>
          <p className='text-sm text-gray-300'>
            How we handle losses and protect capital with proper risk management
          </p>
        </div>

        <div className='bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl p-4 border border-blue-400/20'>
          <div className='flex items-center gap-3 mb-2'>
            <Award className='w-5 h-5 text-blue-400' />
            <span className='text-white font-medium'>Performance Metrics</span>
          </div>
          <p className='text-sm text-gray-300'>
            Regular updates on win rates, profit factors, and overall
            performance
          </p>
        </div>

        <div className='bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-xl p-4 border border-purple-400/20'>
          <div className='flex items-center gap-3 mb-2'>
            <BarChart3 className='w-5 h-5 text-purple-400' />
            <span className='text-white font-medium'>Market Analysis</span>
          </div>
          <p className='text-sm text-gray-300'>
            Insights into market conditions and how they affect our trading
            decisions
          </p>
        </div>
      </div>

      <div className='text-center mt-6 p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-xl border border-yellow-400/20'>
        <p className='text-sm text-gray-300'>
          <span className='text-yellow-400 font-medium'>Note:</span> Only our
          verified administrators can post updates to ensure authenticity and
          accuracy.
        </p>
      </div>
    </div>
  );
}
