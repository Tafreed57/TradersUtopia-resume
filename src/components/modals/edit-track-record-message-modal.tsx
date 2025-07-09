'use client';

import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { useStore } from '@/store/store';
import { secureAxiosPatch } from '@/lib/csrf-client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Edit, Loader2 } from 'lucide-react';

const formSchema = z.object({
  content: z.string().min(1, 'Content is required').max(4000),
});

export function EditTrackRecordMessageModal() {
  const router = useRouter();
  const type = useStore(state => state.type);
  const isOpen = useStore(state => state.isOpen);
  const onClose = useStore(state => state.onClose);
  const data = useStore(state => state.data);
  const isModelOpen = isOpen && type === 'editTrackRecordMessage';
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: '',
    },
  });

  // Update form values when data changes
  React.useEffect(() => {
    if (data?.message?.content) {
      form.setValue('content', data.message.content);
    }
  }, [data?.message?.content, form]);

  const handleEdit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsLoading(true);

      await secureAxiosPatch(
        `/api/track-record/messages/${data?.message?.id}`,
        {
          content: values.content,
        }
      );

      form.reset();
      onClose();

      // Refresh the page to update the messages
      router.refresh();

      // Also trigger a custom event to refresh the track record component
      window.dispatchEvent(new CustomEvent('trackRecordRefresh'));
    } catch (error: any) {
      console.log(error, 'EDIT TRACK RECORD MESSAGE ERROR');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isModelOpen} onOpenChange={handleClose}>
      <DialogContent
        aria-describedby={undefined}
        className='bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl border border-gray-700/50 text-white p-0 overflow-hidden w-[90vw] max-w-lg mx-auto'
      >
        <DialogHeader className='pt-6 sm:pt-8 px-4 sm:px-6'>
          <DialogTitle className='text-xl sm:text-2xl text-center font-bold flex items-center justify-center gap-2'>
            <Edit className='h-5 w-5 text-purple-400' />
            Edit Track Record Message
          </DialogTitle>
          <DialogDescription className='text-center text-zinc-400 text-sm sm:text-base'>
            Update your track record message. This will be visible to all users.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleEdit)} className='space-y-4'>
            <div className='px-4 sm:px-6 space-y-4'>
              <FormField
                control={form.control}
                name='content'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='text-sm font-medium text-gray-300'>
                      Message Content
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        disabled={isLoading}
                        className='bg-gradient-to-r from-gray-800/80 to-gray-700/80 border border-gray-600/30 focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400/50 focus:ring-offset-0 text-white placeholder:text-gray-400 rounded-xl min-h-[120px] max-h-[300px] resize-none transition-all duration-300 hover:border-gray-500/50'
                        placeholder='Share your track record update...'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl p-3 border border-blue-400/20'>
                <div className='flex items-center gap-2 mb-1'>
                  <div className='w-2 h-2 bg-blue-400 rounded-full'></div>
                  <span className='text-blue-400 font-medium text-sm'>
                    Notice
                  </span>
                </div>
                <p className='text-xs text-gray-300'>
                  This message will be marked as edited and the timestamp will
                  be updated.
                </p>
              </div>
            </div>

            <DialogFooter className='px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-800/80 via-gray-700/80 to-gray-800/80 backdrop-blur-sm border-t border-gray-700/50'>
              <div className='flex flex-col sm:flex-row items-center gap-3 sm:justify-between w-full'>
                <Button
                  disabled={isLoading}
                  onClick={handleClose}
                  variant='ghost'
                  className='w-full sm:w-auto min-h-[44px] touch-manipulation'
                >
                  Cancel
                </Button>
                <Button
                  disabled={isLoading}
                  type='submit'
                  className='w-full sm:w-auto min-h-[44px] touch-manipulation bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500'
                >
                  {isLoading ? (
                    <>
                      <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Edit className='h-4 w-4 mr-2' />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
