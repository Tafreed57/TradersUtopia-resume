import { Hash } from 'lucide-react';
import React from 'react';

interface ChatWelcomeProps {
  name: string;
  type: 'channel' | 'conversation';
}

export function ChatWelcome({ name, type }: ChatWelcomeProps) {
  return (
    <div className='space-y-3 sm:space-y-4 px-4 sm:px-6 mb-6 sm:mb-8 text-center sm:text-left'>
      {type === 'channel' && (
        <div className='h-16 w-16 sm:h-20 sm:w-20 md:h-[75px] md:w-[75px] rounded-full bg-zinc-500 flex items-center justify-center mx-auto sm:mx-0 shadow-lg'>
          <Hash className='text-white h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12' />
        </div>
      )}
      <div className='space-y-2'>
        <p className='text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-black leading-tight'>
          {type === 'channel' ? 'Welcome to #' : ''}
          {name}
        </p>
        <p className='text-sm sm:text-base text-zinc-600 leading-relaxed max-w-md mx-auto sm:mx-0'>
          {type === 'channel'
            ? `This is the start of the #${name} channel.`
            : `This is the start of the conversation with ${name}.`}
        </p>
      </div>
    </div>
  );
}
