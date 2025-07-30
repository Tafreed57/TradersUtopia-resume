'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className='min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95'>
      <div className='text-center space-y-6 max-w-md'>
        <div className='space-y-2'>
          <h1 className='text-8xl font-bold text-yellow-400'>404</h1>
          <h2 className='text-2xl font-semibold text-white'>Page Not Found</h2>
          <p className='text-gray-400'>
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div className='flex flex-col sm:flex-row gap-3 justify-center'>
          <Button asChild variant='default'>
            <Link href='/' className='flex items-center gap-2'>
              <Home className='w-4 h-4' />
              Go Home
            </Link>
          </Button>
          <Button
            variant='outline'
            onClick={() => window.history.back()}
            className='flex items-center gap-2'
          >
            <ArrowLeft className='w-4 h-4' />
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}
