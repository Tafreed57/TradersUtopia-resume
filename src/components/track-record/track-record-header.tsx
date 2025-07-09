'use client';

import { BarChart3, Shield, Users, Clock } from 'lucide-react';

export function TrackRecordHeader() {
  return (
    <div className='flex items-center p-4 sm:p-6 border-b border-gray-600/30 bg-gradient-to-r from-gray-800/80 to-gray-700/80 backdrop-blur-sm'>
      <div className='flex items-center gap-3 flex-1'>
        <div className='w-10 h-10 bg-gradient-to-br from-purple-500/20 to-blue-600/20 rounded-xl flex items-center justify-center'>
          <BarChart3 className='w-5 h-5 text-purple-400' />
        </div>
        <div className='flex flex-col'>
          <h2 className='text-lg sm:text-xl font-bold text-white'>
            Live Track Record
          </h2>
          <p className='text-sm text-gray-400'>
            Real-time trading updates from our professional traders
          </p>
        </div>
      </div>

      <div className='flex items-center gap-4 text-sm text-gray-400'>
        <div className='hidden sm:flex items-center gap-2'>
          <Shield className='w-4 h-4' />
          <span>Admin Only Posts</span>
        </div>
        <div className='flex items-center gap-2'>
          <Users className='w-4 h-4' />
          <span>Public View</span>
        </div>
        <div className='flex items-center gap-2'>
          <div className='w-2 h-2 bg-green-400 rounded-full animate-pulse' />
          <span className='hidden sm:inline'>Live</span>
        </div>
      </div>
    </div>
  );
}
