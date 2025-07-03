import { Hash } from 'lucide-react';
import React from 'react';

interface ChatWelcomeProps {
  name: string;
  type: 'channel' | 'conversation';
}

export function ChatWelcome({ name, type }: ChatWelcomeProps) {
  return (
    <div className='space-y-4 sm:space-y-6 px-4 sm:px-6 mb-8 sm:mb-12 text-center sm:text-left'>
      {type === 'channel' && (
        <div className='h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-blue-400/30 backdrop-blur-sm flex items-center justify-center mx-auto sm:mx-0 shadow-2xl shadow-blue-400/20 relative overflow-hidden group'>
          {/* Background pattern */}
          <div className='absolute inset-0 bg-gradient-to-br from-blue-600/10 to-purple-600/10 group-hover:from-blue-600/20 group-hover:to-purple-600/20 transition-all duration-500' />
          <Hash className='text-blue-400 h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 relative z-10 group-hover:scale-110 transition-transform duration-300' />
        </div>
      )}
      <div className='space-y-3 sm:space-y-4'>
        <div className='space-y-2'>
          <p className='text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight bg-gradient-to-r from-blue-400 via-purple-500 to-pink-400 bg-clip-text text-transparent'>
            {type === 'channel' ? 'Welcome to #' : ''}
            {name}
          </p>
          <div className='w-24 h-1 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full mx-auto sm:mx-0' />
        </div>
        <p className='text-base sm:text-lg text-gray-300 leading-relaxed max-w-md mx-auto sm:mx-0 font-medium'>
          {type === 'channel'
            ? `This is the start of the #${name} channel.`
            : `This is the start of the conversation with ${name}.`}
        </p>
        <p className='text-sm text-gray-500 max-w-md mx-auto sm:mx-0'>
          {type === 'channel'
            ? 'Share your thoughts, ask questions, and collaborate with your community members.'
            : 'Start a conversation and connect with each other.'}
        </p>
      </div>
    </div>
  );
}
