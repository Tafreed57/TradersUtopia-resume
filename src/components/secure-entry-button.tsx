'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, DollarSign, ArrowRight } from 'lucide-react';

export function SecureEntryButton() {
  const router = useRouter();
  const [isVerifying, setIsVerifying] = useState(false);

  const handleViewPricing = async () => {
    console.log('💰 Redirecting to pricing page...');
    setIsVerifying(true);

    // Add a brief loading state for visual feedback
    setTimeout(() => {
      router.push('/pricing');
    }, 300);
  };

  return (
    <Button
      size='lg' className='bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 hover:from-blue-700 hover:via-purple-700 hover:to-indigo-800 text-white px-8 py-4 text-lg font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none border border-blue-400/30 hover:border-purple-400/50 hover:shadow-purple-500/25'
      onClick={handleViewPricing}
      disabled={isVerifying}
    >
      {isVerifying ? (
        <div className='flex items-center gap-2'>
          <Loader2 className='h-5 w-5 animate-spin text-yellow-300' />
          <span className='bg-gradient-to-r from-white to-gray-100 bg-clip-text text-transparent'>
            Loading Pricing...
          </span>
        </div>
      ) : (
        <div className='flex items-center gap-2'>
          <DollarSign className='h-5 w-5 animate-pulse text-yellow-300' />
          <span className='bg-gradient-to-r from-white to-gray-100 bg-clip-text text-transparent'>
            💎 View Pricing
          </span>
          <ArrowRight className='h-4 w-4 text-yellow-300 animate-bounce' />
        </div>
      )}
    </Button>
  );
}
