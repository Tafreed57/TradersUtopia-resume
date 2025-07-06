'use client';

import { useState } from 'react';
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
import { Shield, Eye, EyeOff, Check, X, Mail } from 'lucide-react';
import { useAuth, useUser } from '@clerk/nextjs';

export function PasswordManager() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const { signOut } = useAuth();
  const { user } = useUser();

  // Password validation - Match backend requirements exactly
  const validatePassword = (password: string) => {
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      // Note: Special characters not required by backend validation
    };
    return requirements;
  };

  const passwordRequirements = validatePassword(newPassword);
  const isValidPassword = Object.values(passwordRequirements).every(Boolean);
  const passwordsMatch =
    newPassword === confirmPassword && newPassword.length > 0;

  // For first-time setup (no password enabled), don't require current password
  const isFirstTimeSetup = user && !user.passwordEnabled;
  const canSubmit = isFirstTimeSetup
    ? isValidPassword && passwordsMatch
    : currentPassword.length > 0 && isValidPassword && passwordsMatch;

  const handlePasswordChange = async () => {
    if (!canSubmit) {
      return;
    }

    setIsChanging(true);
    setErrors({});

    try {
      const requestBody = {
        action: isFirstTimeSetup ? 'setup' : 'change',
        currentPassword: isFirstTimeSetup ? undefined : currentPassword,
        newPassword,
        confirmPassword,
      };

      const response = await fetch('/api/user/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.details) {
          const errorMap = data.details.reduce((acc: any, error: any) => {
            acc[error.field] = error.message;
            return acc;
          }, {});
          setErrors(errorMap);
        }

        // Show specific error message or generic one
        const errorMessage =
          data.message || data.error || 'Failed to set up password';
        throw new Error(errorMessage);
      }

      toast.success(
        isFirstTimeSetup
          ? 'Password set up successfully!'
          : 'Password changed successfully!',
        {
          description: isFirstTimeSetup
            ? 'You can now use password authentication and cancel your subscription.'
            : 'Your password has been updated.',
        }
      );

      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Password change error:', error);
      toast.error('Password change failed', {
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsChanging(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!user?.primaryEmailAddress?.emailAddress) {
      toast.error('Email not found', {
        description: 'Unable to initiate password reset.',
      });
      return;
    }

    setIsRequestingReset(true);

    try {
      toast.info('Redirecting to password reset...', {
        description: 'You will be taken to the password reset page.',
      });

      // Redirect to the dedicated forgot password page
      window.location.href = '/forgot-password';
    } catch (error: any) {
      console.error('Password reset redirect error:', error);
      toast.error('Navigation failed', {
        description:
          error.message || 'Unable to navigate to password reset page.',
      });
      setIsRequestingReset(false);
    }
  };

  return (
    <div className='w-full max-w-2xl mx-auto space-y-6'>
      <Card className='bg-gray-800/50 backdrop-blur-sm border border-gray-700/50'>
        <CardHeader>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center'>
              <Shield className='h-5 w-5 text-green-400' />
            </div>
            <div>
              <CardTitle className='text-white'>
                {isFirstTimeSetup ? 'Set Up Password' : 'Change Password'}
              </CardTitle>
              <CardDescription>
                {isFirstTimeSetup
                  ? 'Set up password authentication to enable subscription management and enhanced security'
                  : 'Update your password to keep your account secure'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className='space-y-6'>
          {/* First-time setup message */}
          {isFirstTimeSetup && (
            <Alert>
              <Shield className='h-4 w-4' />
              <AlertDescription>
                You're setting up your first password. This will enable password
                authentication for your account and allow you to cancel
                subscriptions securely.
              </AlertDescription>
            </Alert>
          )}

          {/* Current Password - Only show for existing password users */}
          {!isFirstTimeSetup && (
            <div className='space-y-2'>
              <Label htmlFor='currentPassword'>Current Password</Label>
              <div className='relative'>
                <Input
                  id='currentPassword'
                  type={showCurrentPassword ? 'text' : 'password'}
                  placeholder='Enter your current password'
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className='pr-10 bg-gray-700/50 border-gray-600 text-white'
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? (
                    <EyeOff className='h-4 w-4 text-gray-400' />
                  ) : (
                    <Eye className='h-4 w-4 text-gray-400' />
                  )}
                </Button>
              </div>
              {errors.currentPassword && (
                <p className='text-sm text-red-400'>{errors.currentPassword}</p>
              )}
              <div className='flex justify-end'>
                <Button
                  type='button'
                  variant='link'
                  className='text-sm text-blue-400 hover:text-blue-300 p-0 h-auto flex items-center gap-1'
                  onClick={handleForgotPassword}
                  disabled={isRequestingReset}
                >
                  {isRequestingReset ? (
                    <>
                      <div className='w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin' />
                      Redirecting...
                    </>
                  ) : (
                    <>
                      <Mail className='w-3 h-3' />
                      Forgot password?
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* New Password */}
          <div className='space-y-2'>
            <Label htmlFor='newPassword'>New Password</Label>
            <div className='relative'>
              <Input
                id='newPassword'
                type={showNewPassword ? 'text' : 'password'}
                placeholder='Enter your new password'
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className='pr-10 bg-gray-700/50 border-gray-600 text-white'
              />
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? (
                  <EyeOff className='h-4 w-4 text-gray-400' />
                ) : (
                  <Eye className='h-4 w-4 text-gray-400' />
                )}
              </Button>
            </div>
            {errors.newPassword && (
              <p className='text-sm text-red-400'>{errors.newPassword}</p>
            )}
          </div>

          {/* Confirm New Password */}
          <div className='space-y-2'>
            <Label htmlFor='confirmPassword'>Confirm New Password</Label>
            <div className='relative'>
              <Input
                id='confirmPassword'
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder='Confirm your new password'
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className='pr-10 bg-gray-700/50 border-gray-600 text-white'
              />
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className='h-4 w-4 text-gray-400' />
                ) : (
                  <Eye className='h-4 w-4 text-gray-400' />
                )}
              </Button>
            </div>
            {errors.confirmPassword && (
              <p className='text-sm text-red-400'>{errors.confirmPassword}</p>
            )}
          </div>

          {/* Password Requirements */}
          {newPassword && (
            <div className='space-y-2'>
              <Label>Password Requirements</Label>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                <div
                  className={`flex items-center gap-2 text-sm ${
                    passwordRequirements.length
                      ? 'text-green-400'
                      : 'text-gray-400'
                  }`}
                >
                  {passwordRequirements.length ? (
                    <Check className='h-4 w-4' />
                  ) : (
                    <X className='h-4 w-4' />
                  )}
                  At least 8 characters
                </div>
                <div
                  className={`flex items-center gap-2 text-sm ${
                    passwordRequirements.uppercase
                      ? 'text-green-400'
                      : 'text-gray-400'
                  }`}
                >
                  {passwordRequirements.uppercase ? (
                    <Check className='h-4 w-4' />
                  ) : (
                    <X className='h-4 w-4' />
                  )}
                  One uppercase letter
                </div>
                <div
                  className={`flex items-center gap-2 text-sm ${
                    passwordRequirements.lowercase
                      ? 'text-green-400'
                      : 'text-gray-400'
                  }`}
                >
                  {passwordRequirements.lowercase ? (
                    <Check className='h-4 w-4' />
                  ) : (
                    <X className='h-4 w-4' />
                  )}
                  One lowercase letter
                </div>
                <div
                  className={`flex items-center gap-2 text-sm ${
                    passwordRequirements.number
                      ? 'text-green-400'
                      : 'text-gray-400'
                  }`}
                >
                  {passwordRequirements.number ? (
                    <Check className='h-4 w-4' />
                  ) : (
                    <X className='h-4 w-4' />
                  )}
                  One number
                </div>
              </div>
            </div>
          )}

          {/* Password Match Indicator */}
          {confirmPassword && (
            <div
              className={`flex items-center gap-2 text-sm ${
                passwordsMatch ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {passwordsMatch ? (
                <Check className='h-4 w-4' />
              ) : (
                <X className='h-4 w-4' />
              )}
              Passwords {passwordsMatch ? 'match' : "don't match"}
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={handlePasswordChange}
            disabled={!canSubmit || isChanging}
            className='w-full bg-green-600 hover:bg-green-700 text-white'
          >
            {isChanging
              ? isFirstTimeSetup
                ? 'Setting Up Password...'
                : 'Changing Password...'
              : isFirstTimeSetup
                ? 'Set Up Password'
                : 'Change Password'}
          </Button>

          {/* Security Note */}
          <Alert>
            <Shield className='h-4 w-4' />
            <AlertDescription>
              For security, you'll be logged out of all devices after changing
              your password.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
