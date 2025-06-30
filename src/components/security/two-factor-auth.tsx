'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Shield,
  ShieldCheck,
  ShieldX,
  Smartphone,
  Copy,
  Eye,
  EyeOff,
} from 'lucide-react';
import { showToast } from '@/lib/notifications-client';
import NextImage from 'next/image';

interface TwoFactorAuthProps {
  initialTwoFactorEnabled?: boolean;
}

export function TwoFactorAuth({
  initialTwoFactorEnabled = false,
}: TwoFactorAuthProps) {
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(
    initialTwoFactorEnabled
  );
  const [setupStep, setSetupStep] = useState<
    'disabled' | 'setup' | 'verify' | 'enabled'
  >('disabled');
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [disableCode, setDisableCode] = useState('');

  // Sync with the prop when it changes
  useEffect(() => {
    console.log(
      'TwoFactorAuth received initialTwoFactorEnabled:',
      initialTwoFactorEnabled
    );
    setTwoFactorEnabled(initialTwoFactorEnabled);
  }, [initialTwoFactorEnabled]);

  useEffect(() => {
    console.log('TwoFactorAuth twoFactorEnabled state:', twoFactorEnabled);
    if (twoFactorEnabled) {
      setSetupStep('enabled');
    } else {
      setSetupStep('disabled');
    }
  }, [twoFactorEnabled]);

  const setup2FA = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/2fa/setup', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        setQrCode(data.qrCode);
        setSecret(data.secret);
        setSetupStep('setup');
        showToast.success(
          '2FA Setup',
          'Scan the QR code with your authenticator app'
        );
      } else {
        showToast.error('Setup Failed', data.error);
      }
    } catch (error) {
      showToast.error('Setup Failed', 'Failed to setup 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  const verify2FA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      showToast.error('Invalid Code', 'Please enter a 6-digit code');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/2fa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: verificationCode }),
      });

      const data = await response.json();

      if (response.ok) {
        setTwoFactorEnabled(true);
        setSetupStep('enabled');
        setBackupCodes(data.backupCodes);
        setShowBackupCodes(true);
        showToast.success(
          '2FA Enabled',
          'Two-factor authentication is now active'
        );
      } else {
        showToast.error('Verification Failed', data.error);
      }
    } catch (error) {
      showToast.error('Verification Failed', 'Failed to verify 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  const disable2FA = async () => {
    if (!disableCode || disableCode.length !== 6) {
      showToast.error('Invalid Code', 'Please enter a 6-digit code');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/2fa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: disableCode }),
      });

      const data = await response.json();

      if (response.ok) {
        setTwoFactorEnabled(false);
        setSetupStep('disabled');
        setDisableCode('');
        setBackupCodes([]);
        showToast.success(
          '2FA Disabled',
          'Two-factor authentication has been disabled'
        );
      } else {
        showToast.error('Disable Failed', data.error);
      }
    } catch (error) {
      showToast.error('Disable Failed', 'Failed to disable 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast.success('Copied', 'Secret copied to clipboard');
  };

  const downloadBackupCodes = () => {
    const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tradersutopia-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast.success('Downloaded', 'Backup codes saved to file');
  };

  return (
    <Card className='w-full max-w-2xl'>
      <CardHeader>
        <div className='flex items-center gap-2'>
          {twoFactorEnabled ? (
            <ShieldCheck className='h-5 w-5 text-green-600' />
          ) : (
            <Shield className='h-5 w-5 text-gray-600' />
          )}
          <CardTitle>Two-Factor Authentication</CardTitle>
          <Badge variant={twoFactorEnabled ? 'default' : 'secondary'}>
            {twoFactorEnabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
        <CardDescription>
          Add an extra layer of security to your account with 2FA
        </CardDescription>
      </CardHeader>

      <CardContent className='space-y-6'>
        {/* Disabled State */}
        {setupStep === 'disabled' && (
          <div className='space-y-4'>
            <div className='flex items-center gap-3 p-4 bg-yellow-900/20 rounded-lg'>
              <ShieldX className='h-5 w-5 text-yellow-600' />
              <div>
                <p className='font-medium text-yellow-300'>
                  2FA is currently disabled
                </p>
                <p className='text-sm text-yellow-300'>
                  Your account is less secure without two-factor authentication
                </p>
              </div>
            </div>

            <Button onClick={setup2FA} disabled={isLoading} className='w-full'>
              <Smartphone className='h-4 w-4 mr-2' />
              {isLoading ? 'Setting up...' : 'Enable 2FA'}
            </Button>
          </div>
        )}

        {/* Setup State */}
        {setupStep === 'setup' && (
          <div className='space-y-4'>
            <div className='text-center space-y-4'>
              <h3 className='font-semibold'>Scan QR Code</h3>
              <p className='text-sm text-gray-600'>
                Scan this QR code with your authenticator app (Google
                Authenticator, Authy, etc.)
              </p>

              {qrCode && (
                <div className='flex justify-center'>
                  <NextImage
                    src={qrCode}
                    alt='2FA QR Code'
                    width={200}
                    height={200}
                    className='border rounded-lg'
                  />
                </div>
              )}

              <div className='space-y-2'>
                <Label htmlFor='secret'>Or enter this secret manually:</Label>
                <div className='flex gap-2'>
                  <Input
                    id='secret'
                    value={secret}
                    readOnly
                    className='font-mono text-sm'
                  />
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => copyToClipboard(secret)}
                  >
                    <Copy className='h-4 w-4' />
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            <div className='space-y-3'>
              <Label htmlFor='verification'>
                Enter the 6-digit code from your app:
              </Label>
              <Input
                id='verification'
                value={verificationCode}
                onChange={e =>
                  setVerificationCode(
                    e.target.value.replace(/\D/g, '').slice(0, 6)
                  )
                }
                placeholder='123456'
                className='text-center text-lg font-mono'
                maxLength={6}
              />
              <div className='flex gap-2'>
                <Button
                  onClick={verify2FA}
                  disabled={isLoading || verificationCode.length !== 6}
                  className='flex-1'
                >
                  {isLoading ? 'Verifying...' : 'Verify & Enable'}
                </Button>
                <Button
                  variant='outline'
                  onClick={() => setSetupStep('disabled')}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Enabled State */}
        {setupStep === 'enabled' && (
          <div className='space-y-4'>
            <div className='flex items-center gap-3 p-4 bg-green-900/20 rounded-lg'>
              <ShieldCheck className='h-5 w-5 text-green-600' />
              <div>
                <p className='font-medium text-green-300'>2FA is active</p>
                <p className='text-sm text-green-300'>
                  Your account is protected with two-factor authentication
                </p>
              </div>
            </div>

            {/* Backup Codes */}
            {backupCodes.length > 0 && (
              <div className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <Label>Backup Codes</Label>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setShowBackupCodes(!showBackupCodes)}
                  >
                    {showBackupCodes ? (
                      <EyeOff className='h-4 w-4' />
                    ) : (
                      <Eye className='h-4 w-4' />
                    )}
                    {showBackupCodes ? 'Hide' : 'Show'}
                  </Button>
                </div>

                {showBackupCodes && (
                  <div className='space-y-2'>
                    <div className='grid grid-cols-2 gap-2 p-3 bg-gray-800 rounded-lg'>
                      {backupCodes.map((code, index) => (
                        <div
                          key={index}
                          className='font-mono text-sm text-center p-2 bg-gray-700 text-white rounded'
                        >
                          {code}
                        </div>
                      ))}
                    </div>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={downloadBackupCodes}
                      className='w-full'
                    >
                      Download Backup Codes
                    </Button>
                    <p className='text-xs text-gray-500'>
                      Save these codes securely. Each can only be used once to
                      access your account if you lose your authenticator.
                    </p>
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Disable 2FA */}
            <div className='space-y-3'>
              <Label htmlFor='disable'>Disable 2FA (Enter current code):</Label>
              <Input
                id='disable'
                value={disableCode}
                onChange={e =>
                  setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder='123456'
                className='text-center font-mono'
                maxLength={6}
              />
              <Button
                variant='destructive'
                onClick={disable2FA}
                disabled={isLoading || disableCode.length !== 6}
                className='w-full'
              >
                {isLoading ? 'Disabling...' : 'Disable 2FA'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
