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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Shield, Eye, EyeOff, Check, X } from 'lucide-react';

export function PasswordManager() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Password validation
  const validatePassword = (password: string) => {
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
    return requirements;
  };

  const passwordRequirements = validatePassword(newPassword);
  const isValidPassword = Object.values(passwordRequirements).every(Boolean);
  const passwordsMatch =
    newPassword === confirmPassword && newPassword.length > 0;
  const canSubmit =
    currentPassword.length > 0 && isValidPassword && passwordsMatch;

  const handlePasswordChange = async () => {
    if (!canSubmit) return;

    setIsChanging(true);
    setErrors({});

    try {
      const response = await fetch('/api/user/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'change',
          currentPassword,
          newPassword,
        }),
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
        throw new Error(data.message || 'Failed to change password');
      }

      toast.success('Password changed successfully!', {
        description: 'Your password has been updated.',
      });

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

  return (
    <div className='w-full max-w-2xl mx-auto space-y-6'>
      <Card className='bg-gray-800/50 backdrop-blur-sm border border-gray-700/50'>
        <CardHeader>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center'>
              <Shield className='h-5 w-5 text-green-400' />
            </div>
            <div>
              <CardTitle className='text-white'>Change Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className='space-y-6'>
          {/* Current Password */}
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
          </div>

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
            {isChanging ? 'Changing Password...' : 'Change Password'}
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
