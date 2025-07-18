'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Clock, Save, RotateCcw } from 'lucide-react';
import { useStore } from '@/store/store';

const timerSettingsSchema = z.object({
  duration: z.number().min(1).max(168), // 1 hour to 7 days
  message: z.string().min(1).max(200),
  priceMessage: z.string().min(1).max(100),
});

type TimerSettingsForm = z.infer<typeof timerSettingsSchema>;

export function TimerSettingsModal() {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { type, isOpen, onClose } = useStore();
  const isModalOpen = isOpen && type === 'timerSettings';

  const form = useForm<TimerSettingsForm>({
    resolver: zodResolver(timerSettingsSchema),
    defaultValues: {
      duration: 72,
      message: 'Lock in current pricing before increase',
      priceMessage: 'Next price increase: $199/month',
    },
  });

  // Fetch current timer settings
  useEffect(() => {
    const fetchCurrentSettings = async () => {
      if (!isModalOpen) return;

      setIsLoadingSettings(true);
      try {
        const response = await fetch('/api/timer/settings');
        const data = await response.json();

        if (data.success && data.settings) {
          form.reset({
            duration: data.settings.duration,
            message: data.settings.message,
            priceMessage: data.settings.priceMessage,
          });
        }
      } catch (error) {
        console.error('Error fetching timer settings:', error);
        setError('Failed to load current settings');
      } finally {
        setIsLoadingSettings(false);
      }
    };

    fetchCurrentSettings();
  }, [isModalOpen, form]);

  // Get CSRF token
  const getCSRFToken = async () => {
    try {
      const response = await fetch('/api/csrf-token');
      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('Failed to get CSRF token:', error);
      return null;
    }
  };

  const onSubmit = async (data: TimerSettingsForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        throw new Error('Failed to get security token');
      }

      const response = await fetch('/api/timer/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || `Failed to update settings: ${response.status}`
        );
      }

      if (result.success) {
        // Close modal and show success
        onClose();

        // Trigger a global refresh of timer components
        window.dispatchEvent(new CustomEvent('timerSettingsUpdated'));
      } else {
        throw new Error(result.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Error updating timer settings:', error);
      setError(
        error instanceof Error ? error.message : 'Failed to update settings'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
      setError(null);
      form.reset();
    }
  };

  const resetToDefaults = () => {
    form.reset({
      duration: 72,
      message: 'Lock in current pricing before increase',
      priceMessage: 'Next price increase: $199/month',
    });
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className='bg-gray-900 border-gray-700 text-white max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-xl font-bold'>
            <Clock className='w-5 h-5 text-yellow-400' />
            Timer Settings
          </DialogTitle>
          <DialogDescription className='text-gray-400'>
            Configure the countdown timer display and messages
          </DialogDescription>
        </DialogHeader>

        {isLoadingSettings ? (
          <div className='flex items-center justify-center py-8'>
            <Loader2 className='w-6 h-6 animate-spin text-yellow-400' />
            <span className='ml-2 text-gray-300'>
              Loading current settings...
            </span>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
              <FormField
                control={form.control}
                name='duration'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='text-gray-200'>
                      Timer Duration (hours)
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type='number'
                        min={1}
                        max={168}
                        placeholder='72'
                        className='bg-gray-800 border-gray-600 text-white focus:border-yellow-400'
                        onChange={e =>
                          field.onChange(parseInt(e.target.value) || 1)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                    <p className='text-xs text-gray-400'>
                      1-168 hours (1 hour to 7 days)
                    </p>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='message'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='text-gray-200'>
                      Timer Message
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder='Lock in current pricing before increase'
                        className='bg-gray-800 border-gray-600 text-white focus:border-yellow-400'
                        maxLength={200}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className='text-xs text-gray-400'>
                      Main message shown with the timer (max 200 characters)
                    </p>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='priceMessage'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='text-gray-200'>
                      Price Message
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder='Next price increase: $199/month'
                        className='bg-gray-800 border-gray-600 text-white focus:border-yellow-400'
                        maxLength={100}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className='text-xs text-gray-400'>
                      Price increase message (max 100 characters)
                    </p>
                  </FormItem>
                )}
              />

              {error && (
                <div className='bg-red-900/30 border border-red-600/30 rounded-lg p-3'>
                  <p className='text-red-400 text-sm'>{error}</p>
                </div>
              )}

              <DialogFooter className='flex justify-between'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={resetToDefaults}
                  disabled={isLoading}
                  className='border-gray-600 text-gray-300 hover:bg-gray-800'
                >
                  <RotateCcw className='w-4 h-4 mr-2' />
                  Reset to Defaults
                </Button>

                <div className='flex gap-2'>
                  <Button
                    type='button'
                    variant='ghost'
                    onClick={handleClose}
                    disabled={isLoading}
                    className='text-gray-300 hover:bg-gray-800'
                  >
                    Cancel
                  </Button>

                  <Button
                    type='submit'
                    disabled={isLoading}
                    className='bg-yellow-600 hover:bg-yellow-700 text-black font-semibold'
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Save className='w-4 h-4 mr-2' />
                        Save Settings
                      </>
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
