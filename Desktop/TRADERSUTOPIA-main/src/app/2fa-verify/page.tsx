"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, CheckCircle, Key } from "lucide-react";
import { useLoading } from "@/contexts/loading-provider";

export default function TwoFactorVerifyPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [requires2FA, setRequires2FA] = useState<boolean | null>(null);
  const { startLoading, stopLoading } = useLoading();
  
  // Use ref to prevent multiple simultaneous checks
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    const check2FAStatus = async () => {
      // Prevent multiple simultaneous checks
      if (hasCheckedRef.current) {
        console.log('🔄 [2FA-VERIFY] Already checked, skipping...');
        return;
      }

      hasCheckedRef.current = true;
      
      try {
        startLoading('Checking 2FA requirements...');
        const response = await fetch('/api/2fa/status', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('🔍 [2FA-VERIFY] 2FA Status Check:', data);
          setRequires2FA(data.requires2FA);
          
          if (!data.requires2FA || data.verified) {
            // User doesn't need 2FA or is already verified, redirect to dashboard
            console.log('✅ [2FA-VERIFY] Redirecting to dashboard - no 2FA needed or already verified');
            router.push('/dashboard');
          }
        } else {
          console.error('❌ [2FA-VERIFY] Failed to check 2FA status');
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('❌ [2FA-VERIFY] Error checking 2FA status:', error);
        router.push('/dashboard');
      } finally {
        stopLoading();
      }
    };

    if (isLoaded && user && !hasCheckedRef.current) {
      check2FAStatus();
    }
  }, [isLoaded, user]); // Removed unstable dependencies

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!verificationCode.trim()) {
      setError("Please enter the 6-digit code");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch('/api/2fa/verify-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: verificationCode
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log('✅ [2FA-VERIFY] Verification successful, redirecting to dashboard');
        // 2FA verification successful, redirect to dashboard
        router.push('/dashboard');
      } else {
        console.error('❌ [2FA-VERIFY] Verification failed:', result);
        setError(result.error || 'Invalid verification code');
      }
    } catch (error) {
      console.error('❌ [2FA-VERIFY] Verification error:', error);
      setError('An error occurred during verification');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isLoaded || requires2FA === null) {
    return null; // Loading is handled by LoadingProvider
  }

  if (!user) {
    router.push('/sign-in');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-950/90 to-black flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-800/90 border-gray-700 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4">
          <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8 text-yellow-400" />
          </div>
          <div>
            <CardTitle className="text-2xl text-white">Two-Factor Authentication</CardTitle>
            <CardDescription className="text-gray-400 mt-2">
              Enter the 6-digit code from your authenticator app to continue
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={handleVerification} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-white">Verification Code</Label>
              <Input
                id="code"
                type="text"
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-2xl tracking-wider bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500"
                maxLength={6}
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-red-400 text-sm">{error}</span>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
              disabled={isLoading || verificationCode.length !== 6}
            >
              {isLoading ? 'Verifying...' : 'Verify & Continue'}
            </Button>
          </form>

          <div className="text-center space-y-3">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 justify-center mb-2">
                <Key className="w-4 h-4 text-blue-400" />
                <span className="text-blue-400 text-sm font-medium">Security Notice</span>
              </div>
              <p className="text-xs text-gray-400">
                This additional security step helps protect your trading account and sensitive data.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 