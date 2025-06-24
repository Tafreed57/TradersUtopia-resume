"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, AlertCircle } from 'lucide-react';
import { showToast } from '@/lib/notifications';

export default function TwoFactorVerifyPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if user is not signed in
  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/sign-in');
    }
  }, [isLoaded, user, router]);

  const handleVerify = async () => {
    if (!code || code.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/2fa/verify-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ 2FA verification successful!', data);
        showToast.success('Verified', '2FA verification successful');
        
        // Get the redirect URL or default to dashboard
        const redirectTo = searchParams?.get('redirect') || '/dashboard';
        console.log('🔄 Redirecting to:', redirectTo);
        
        // Small delay to ensure cookie is set, then trigger re-check
        setTimeout(() => {
          // Trigger the TwoFactorGuard to re-check
          window.dispatchEvent(new CustomEvent('force-2fa-recheck'));
          router.push(redirectTo);
        }, 100);
      } else {
        console.error('❌ 2FA verification failed:', data);
        setError(data.error || 'Verification failed');
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleVerify();
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <CardTitle className="text-2xl">Two-Factor Authentication</CardTitle>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Enter the 6-digit code from your authenticator app to complete sign-in
          </p>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Authentication Code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyPress={handleKeyPress}
              placeholder="123456"
              className="text-center text-lg font-mono"
              maxLength={6}
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <Button 
            onClick={handleVerify}
            disabled={isLoading || code.length !== 6}
            className="w-full"
          >
            {isLoading ? 'Verifying...' : 'Verify & Continue'}
          </Button>

          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Can't access your authenticator app?
            </p>
            <Button 
              variant="link" 
              className="text-sm p-0"
              onClick={() => showToast.info('Contact Support', 'Please contact support for assistance with 2FA recovery')}
            >
              Use backup code or contact support
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 