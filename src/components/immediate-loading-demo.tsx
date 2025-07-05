'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Zap, CheckCircle } from 'lucide-react';

export function ImmediateLoadingDemo() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>('');

  const handleClick = async () => {
    // ✅ IMMEDIATE FEEDBACK: Set loading state immediately
    setIsLoading(true);
    setMessage('Loading started instantly!');

    try {
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 2000));

      setMessage('✅ Action completed successfully!');

      // Clear success message after 2 seconds
      setTimeout(() => {
        setMessage('');
      }, 2000);
    } catch (error) {
      setMessage('❌ Something went wrong');
      setTimeout(() => {
        setMessage('');
      }, 2000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className='w-full max-w-md mx-auto'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Zap className='h-5 w-5 text-yellow-500' />
          Immediate Loading Demo
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <p className='text-sm text-muted-foreground'>
          Click the button below to test immediate loading feedback. The loading
          state should appear instantly!
        </p>

        <Button onClick={handleClick} disabled={isLoading} className='w-full'>
          {isLoading ? (
            <>
              <Loader2 className='h-4 w-4 mr-2 animate-spin' />
              Loading...
            </>
          ) : (
            <>
              <Zap className='h-4 w-4 mr-2' />
              Test Immediate Loading
            </>
          )}
        </Button>

        {message && (
          <div className='p-3 bg-gray-50 rounded-lg border text-sm'>
            {message}
          </div>
        )}

        <div className='text-xs text-muted-foreground'>
          Expected: Loading state shows immediately when clicked, no delay!
        </div>
      </CardContent>
    </Card>
  );
}
