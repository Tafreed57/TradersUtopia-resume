'use client';

import React, { useState, useEffect } from 'react';
import { useSignIn, useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { ArrowLeft, Mail, Key, Loader2, Info } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [successfulCreation, setSuccessfulCreation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsSignOut, setNeedsSignOut] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);

  const router = useRouter();
  const { isSignedIn, signOut } = useAuth();
  const { isLoaded, signIn, setActive } = useSignIn();
  const { user } = useUser();

  // Check if user is signed in and needs to be signed out for password reset
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setNeedsSignOut(true);
    }
  }, [isLoaded, isSignedIn]);

  // Determine if this is a password reset or password setup scenario
  useEffect(() => {
    if (isLoaded && user && user.passwordEnabled) {
      setIsPasswordReset(true);
    }
  }, [isLoaded, user]);

  // Handle persistence across sign-out
  useEffect(() => {
    if (isLoaded) {
      // Check if we're returning from a sign-out process
      const storedEmail = localStorage.getItem('forgot-password-email');
      const storedFlow = localStorage.getItem('forgot-password-flow');

      if (storedEmail && storedFlow === 'reset-initiated' && !isSignedIn) {
        // We've successfully signed out and need to send the reset code
        setEmail(storedEmail);
        setNeedsSignOut(false);

        // Automatically initiate password reset
        initiatePasswordReset(storedEmail);

        // Clean up the flow marker
        localStorage.removeItem('forgot-password-flow');
      } else if (storedEmail && storedFlow === 'code-sent') {
        // We've sent the code and are waiting for user input
        setEmail(storedEmail);
        setSuccessfulCreation(true);
        setNeedsSignOut(false);

        // Clean up storage
        localStorage.removeItem('forgot-password-email');
        localStorage.removeItem('forgot-password-flow');
      }
    }
  }, [isLoaded, isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill email for signed-in users
  useEffect(() => {
    if (isLoaded && user?.primaryEmailAddress?.emailAddress && !email) {
      setEmail(user.primaryEmailAddress.emailAddress);
    }
  }, [isLoaded, user, email]);

  if (!isLoaded) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-gray-900 to-black safe-area-full'>
        <Loader2 className='w-8 h-8 animate-spin text-yellow-500' />
      </div>
    );
  }

  // Handle signing out the user before password reset
  const handleSignOutAndReset = async () => {
    if (!email) {
      setError('Please enter your email address first');
      return;
    }

    // Validate email matches user's account email
    if (
      user?.primaryEmailAddress?.emailAddress &&
      email.toLowerCase() !==
        user.primaryEmailAddress.emailAddress.toLowerCase()
    ) {
      setError('Email address does not match your account');
      toast.error('Email mismatch', {
        description:
          'Please enter the email address associated with your account.',
      });
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Store email and flow state for after sign-out
      localStorage.setItem('forgot-password-email', email);
      localStorage.setItem('forgot-password-flow', 'reset-initiated');

      toast.info('Signing you out...', {
        description: isPasswordReset
          ? 'Required for password reset process'
          : 'Required for password setup process',
      });

      // Sign out the user and redirect back to this page
      await signOut({ redirectUrl: '/forgot-password' });
    } catch (err: any) {
      console.error('Sign out error:', err);
      setError('Failed to sign out. Please try again.');
      setIsLoading(false);

      // Clean up storage on error
      localStorage.removeItem('forgot-password-email');
      localStorage.removeItem('forgot-password-flow');
    }
  };

  // Initiate password reset (for signed-out users)
  const initiatePasswordReset = async (emailToUse?: string) => {
    const resetEmail = emailToUse || email;

    try {
      // For signed-out users, validate email exists in our database
      if (!user) {
        const response = await fetch('/api/user/validate-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: resetEmail }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Email validation failed');
        }

        const { exists } = await response.json();
        if (!exists) {
          throw new Error('No account found with this email address');
        }
      }

      await signIn?.create({
        strategy: 'reset_password_email_code',
        identifier: resetEmail,
      });

      // Store state to persist the "code sent" status
      localStorage.setItem('forgot-password-email', resetEmail);
      localStorage.setItem('forgot-password-flow', 'code-sent');

      setSuccessfulCreation(true);
      setNeedsSignOut(false);
      toast.success('Verification code sent!', {
        description: 'Check your email for the verification code.',
      });
    } catch (err: any) {
      console.error('Password reset error:', err);
      const errorMessage =
        err.errors?.[0]?.longMessage ||
        err.message ||
        'Failed to send verification code';
      setError(errorMessage);
      toast.error('Failed to send verification code', {
        description: errorMessage,
      });

      // Clean up storage on error
      localStorage.removeItem('forgot-password-email');
      localStorage.removeItem('forgot-password-flow');
    } finally {
      setIsLoading(false);
    }
  };

  // Send the password reset code to the user's email
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setError('');

    // If user is signed in, we need to sign them out first
    if (needsSignOut) {
      await handleSignOutAndReset();
    } else {
      await initiatePasswordReset();
    }
  };

  // Reset the user's password using the code and new password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !password) return;

    setIsLoading(true);
    setError('');

    try {
      const result = await signIn?.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
        password,
      });

      if (result?.status === 'complete') {
        await setActive({ session: result.createdSessionId });

        // Clean up any remaining storage
        localStorage.removeItem('forgot-password-email');
        localStorage.removeItem('forgot-password-flow');

        toast.success(
          isPasswordReset
            ? 'Password reset successfully!'
            : 'Password created successfully!',
          {
            description: isPasswordReset
              ? 'Your password has been updated. You can now sign in with your new password.'
              : 'You can now sign in with your email and password.',
          }
        );
        router.push('/dashboard');
      } else if (result?.status === 'needs_second_factor') {
        toast.error('2FA required', {
          description: 'This account has 2FA enabled. Please sign in normally.',
        });
        router.push('/sign-in');
      } else {
        console.error('Unexpected result:', result);
        setError(
          isPasswordReset
            ? 'Password reset failed. Please try again.'
            : 'Password creation failed. Please try again.'
        );
      }
    } catch (err: any) {
      console.error('Password reset error:', err);
      const errorMessage =
        err.errors?.[0]?.longMessage ||
        err.message ||
        (isPasswordReset
          ? 'Failed to reset password'
          : 'Failed to create password');
      setError(errorMessage);
      toast.error(
        isPasswordReset ? 'Password reset failed' : 'Password creation failed',
        {
          description: errorMessage,
        }
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='min-h-screen flex flex-col justify-center items-center p-4 bg-gradient-to-br from-slate-900 via-gray-900 to-black pwa-layout safe-min-height'>
      <div className='pwa-safe-top pwa-safe-bottom safe-area-inset-left safe-area-inset-right w-full'>
        {/* Header */}
        <div className='w-full max-w-md mx-auto mb-8 text-center'>
          <h1 className='text-2xl sm:text-3xl font-bold text-white mb-2'>
            {isPasswordReset ? 'Reset Your Password' : 'Set Up Your Password'}
          </h1>
          <p className='text-gray-400 text-sm sm:text-base'>
            {successfulCreation
              ? `Enter the code sent to your email and ${isPasswordReset ? 'reset' : 'create'} your password`
              : isPasswordReset
                ? 'Enter your email to receive a password reset code'
                : 'Create a password for your account to enable password-based sign-in'}
          </p>
        </div>

        {/* Main Form */}
        <Card className='w-full max-w-md bg-gray-800/50 backdrop-blur-sm border border-gray-700/50'>
          <CardHeader className='text-center'>
            <CardTitle className='flex items-center justify-center gap-2 text-white'>
              {successfulCreation ? (
                <Key className='w-5 h-5' />
              ) : (
                <Mail className='w-5 h-5' />
              )}
              {successfulCreation
                ? isPasswordReset
                  ? 'Reset Your Password'
                  : 'Create Your Password'
                : isPasswordReset
                  ? 'Password Reset'
                  : 'Password Setup'}
            </CardTitle>
            <CardDescription>
              {successfulCreation
                ? 'We sent a verification code to your email'
                : isPasswordReset
                  ? "We'll send you a code to reset your password"
                  : "We'll send you a code to verify your email and set up your password"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!successfulCreation ? (
              // Email form
              <>
                {needsSignOut && (
                  <Alert className='mb-4 bg-blue-900/20 border-blue-500/30'>
                    <Info className='h-4 w-4 text-blue-400' />
                    <AlertDescription className='text-blue-300'>
                      You'll be signed out first to complete the{' '}
                      {isPasswordReset ? 'password reset' : 'password setup'}{' '}
                      process. This is required by the security system.
                    </AlertDescription>
                  </Alert>
                )}

                {user?.primaryEmailAddress?.emailAddress && (
                  <Alert className='mb-4 bg-gray-900/20 border-gray-600/30'>
                    <Mail className='h-4 w-4 text-gray-400' />
                    <AlertDescription className='text-gray-300'>
                      Use your account email:{' '}
                      <span className='font-mono text-yellow-400'>
                        {user.primaryEmailAddress.emailAddress}
                      </span>
                    </AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSendCode} className='space-y-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='email' className='text-gray-300'>
                      Email Address
                    </Label>
                    <Input
                      id='email'
                      type='email'
                      placeholder='Enter your account email address'
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className='bg-gray-700/50 border-gray-600 text-white'
                      required
                    />
                  </div>

                  {error && (
                    <Alert className='bg-red-900/20 border-red-500/30'>
                      <AlertDescription className='text-red-400'>
                        {error}
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type='submit'
                    disabled={!email || isLoading}
                    className='w-full bg-yellow-600 hover:bg-yellow-700 text-black font-semibold'
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                        {needsSignOut
                          ? 'Signing Out & Sending...'
                          : 'Sending Code...'}
                      </>
                    ) : (
                      'Send Verification Code'
                    )}
                  </Button>
                </form>
              </>
            ) : (
              // Password reset form
              <form onSubmit={handleResetPassword} className='space-y-4'>
                <div className='space-y-2'>
                  <Label htmlFor='code' className='text-gray-300'>
                    Verification Code
                  </Label>
                  <Input
                    id='code'
                    type='text'
                    placeholder='Enter the 6-digit code'
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    className='bg-gray-700/50 border-gray-600 text-white'
                    maxLength={6}
                    required
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='password' className='text-gray-300'>
                    {isPasswordReset ? 'New Password' : 'Password'}
                  </Label>
                  <Input
                    id='password'
                    type='password'
                    placeholder={
                      isPasswordReset
                        ? 'Enter your new password'
                        : 'Create your password'
                    }
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className='bg-gray-700/50 border-gray-600 text-white'
                    required
                  />
                </div>

                {error && (
                  <Alert className='bg-red-900/20 border-red-500/30'>
                    <AlertDescription className='text-red-400'>
                      {error}
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  type='submit'
                  disabled={!code || !password || isLoading}
                  className='w-full bg-yellow-600 hover:bg-yellow-700 text-black font-semibold'
                >
                  {isLoading ? (
                    <>
                      <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                      {isPasswordReset
                        ? 'Resetting Password...'
                        : 'Creating Password...'}
                    </>
                  ) : isPasswordReset ? (
                    'Reset Password'
                  ) : (
                    'Create Password'
                  )}
                </Button>

                <Button
                  type='button'
                  variant='outline'
                  onClick={() => {
                    setSuccessfulCreation(false);
                    setError('');
                    setCode('');
                    setPassword('');
                    // Clean up storage when going back
                    localStorage.removeItem('forgot-password-email');
                    localStorage.removeItem('forgot-password-flow');
                  }}
                  className='w-full bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700/50'
                >
                  Back to Email Entry
                </Button>
              </form>
            )}

            {/* Back to Sign In */}
            <div className='mt-6 pt-6 border-t border-gray-700/50'>
              <Link
                href='/sign-in'
                className='flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors'
              >
                <ArrowLeft className='w-4 h-4' />
                Back to Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
