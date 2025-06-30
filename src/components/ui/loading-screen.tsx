'use client';

import { useEffect, useState } from 'react';
import { Loader2, TrendingUp } from 'lucide-react';
import NextImage from 'next/image';

interface LoadingScreenProps {
  isVisible: boolean;
  message?: string;
}

export function LoadingScreen({
  isVisible,
  message = 'Loading...',
}: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [currentMessage, setCurrentMessage] = useState(message);

  useEffect(() => {
    if (!isVisible) {
      setProgress(0);
      return;
    }

    // Simulate loading progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return prev;
        return prev + Math.random() * 15;
      });
    }, 150);

    // Change loading messages
    const messages = [
      'Loading your trading platform...',
      'Preparing market data...',
      'Securing your connection...',
      'Almost ready...',
    ];

    let messageIndex = 0;
    const messageInterval = setInterval(() => {
      if (messageIndex < messages.length - 1) {
        messageIndex++;
        setCurrentMessage(messages[messageIndex]);
      }
    }, 800);

    return () => {
      clearInterval(interval);
      clearInterval(messageInterval);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className='fixed inset-0 z-[9999] bg-gradient-to-br from-gray-950 via-slate-950/90 to-black text-white flex items-center justify-center'>
      {/* Animated Background Effects */}
      <div className='absolute inset-0 overflow-hidden'>
        <div className='absolute -top-40 -right-40 w-80 h-80 bg-yellow-500/10 rounded-full blur-3xl animate-pulse'></div>
        <div className='absolute top-40 -left-40 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse delay-1000'></div>
        <div className='absolute bottom-40 right-20 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-2000'></div>
        <div className='absolute top-20 left-1/2 w-72 h-72 bg-green-500/5 rounded-full blur-3xl animate-pulse delay-3000'></div>
      </div>

      <div className='relative z-10 text-center max-w-md mx-auto px-6'>
        {/* Logo and Branding */}
        <div className='mb-8'>
          <div className='flex items-center justify-center gap-3 mb-4'>
            <div className='w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center shadow-2xl animate-pulse'>
              <NextImage
                src='/logo.png'
                alt='TradersUtopia'
                width={32}
                height={32} className='filter brightness-0'
              />
            </div>
            <div className='text-left'>
              <h1 className='text-2xl font-bold bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent'>
                TradersUtopia
              </h1>
              <p className='text-gray-400 text-sm'>
                Professional Trading Platform
              </p>
            </div>
          </div>
        </div>

        {/* Main Loading Animation */}
        <div className='mb-8'>
          <div className='relative w-24 h-24 mx-auto mb-6'>
            {/* Outer spinning ring */}
            <div className='absolute inset-0 border-4 border-gray-700 rounded-full'></div>
            <div className='absolute inset-0 border-4 border-yellow-400 rounded-full border-t-transparent animate-spin'></div>

            {/* Inner pulsing circle */}
            <div className='absolute inset-4 bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 rounded-full animate-pulse flex items-center justify-center'>
              <TrendingUp className='w-8 h-8 text-yellow-400 animate-bounce' />
            </div>
          </div>

          {/* Progress Bar */}
          <div className='w-full bg-gray-800 rounded-full h-2 mb-4 overflow-hidden'>
            <div className='h-full bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 rounded-full transition-all duration-300 ease-out shadow-lg shadow-yellow-400/50'
              style={{ width: `${Math.min(progress, 100)}%` }}
            ></div>
          </div>

          {/* Progress Percentage */}
          <div className='text-yellow-400 text-sm font-medium mb-2'>
            {Math.round(Math.min(progress, 100))}%
          </div>
        </div>

        {/* Loading Message */}
        <div className='space-y-2'>
          <p className='text-lg font-medium text-white animate-pulse'>
            {currentMessage}
          </p>
          <p className='text-gray-400 text-sm'>
            Please wait while we prepare your experience
          </p>
        </div>

        {/* Animated Dots */}
        <div className='flex justify-center space-x-1 mt-6'>
          <div className='w-2 h-2 bg-yellow-400 rounded-full animate-bounce'></div>
          <div className='w-2 h-2 bg-yellow-400 rounded-full animate-bounce delay-100'></div>
          <div className='w-2 h-2 bg-yellow-400 rounded-full animate-bounce delay-200'></div>
        </div>

        {/* Subtle Feature Hints */}
        <div className='mt-8 space-y-2 text-xs text-gray-500'>
          <div className='flex items-center justify-center gap-2 animate-fade-in-up'>
            <div className='w-1 h-1 bg-green-400 rounded-full'></div>
            <span>Real-time market data</span>
          </div>
          <div className='flex items-center justify-center gap-2 animate-fade-in-up delay-200'>
            <div className='w-1 h-1 bg-blue-400 rounded-full'></div>
            <span>Professional analytics</span>
          </div>
          <div className='flex items-center justify-center gap-2 animate-fade-in-up delay-400'>
            <div className='w-1 h-1 bg-purple-400 rounded-full'></div>
            <span>Secure trading environment</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
        }

        .delay-200 {
          animation-delay: 0.2s;
        }

        .delay-400 {
          animation-delay: 0.4s;
        }
      `}</style>
    </div>
  );
}
