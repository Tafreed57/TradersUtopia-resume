'use client';

import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Send } from 'lucide-react';
import { useForm } from 'react-hook-form';
import z from 'zod';
import { secureAxiosPost } from '@/lib/csrf-client';
import { useStore } from '@/store/store';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useState, useRef } from 'react';

const formSchema = z.object({
  content: z.string().min(1),
});

interface TrackRecordInputProps {
  apiUrl: string;
}

export function TrackRecordInput({ apiUrl }: TrackRecordInputProps) {
  const onOpen = useStore(state => state.onOpen);
  const router = useRouter();
  const { user } = useUser();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: '',
    },
  });

  const isLoading = form.formState.isSubmitting;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await secureAxiosPost('/api/track-record/messages', values);
      form.reset();

      // Reset textarea height
      const textarea = document.querySelector(
        'textarea[name="content"]'
      ) as HTMLTextAreaElement;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = '52px';
      }

      // Invalidate and refetch track record messages
      queryClient.invalidateQueries({ queryKey: ['track-record-messages'] });
    } catch (error) {
      console.log(error);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.handleSubmit(onSubmit)();

      setTimeout(() => {
        const textarea = event.target as HTMLTextAreaElement;
        if (textarea) {
          textarea.style.height = '52px';
        }
      }, 100);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name='content'
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className='relative p-4 sm:p-6 bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl border-t border-gray-700/50'>
                  {/* Background pattern */}
                  <div className='absolute inset-0 bg-gradient-to-r from-purple-900/5 via-transparent to-blue-900/5 pointer-events-none' />

                  {/* Admin indicator */}
                  <div className='absolute top-2 left-6 sm:left-8 text-xs text-red-400 font-medium'>
                    ADMIN ONLY
                  </div>

                  {/* Add Media Button */}
                  <button
                    type='button'
                    onClick={() =>
                      onOpen('trackRecordFile', {
                        apiUrl: '/api/track-record/messages',
                      })
                    }
                    className='absolute top-1/2 -translate-y-1/2 left-6 sm:left-8 h-9 w-9 sm:h-10 sm:w-10 bg-gradient-to-br from-purple-600/20 to-blue-600/20 hover:from-purple-600/30 hover:to-blue-600/30 border border-purple-400/30 hover:border-purple-400/50 transition-all duration-300 rounded-xl flex items-center justify-center touch-manipulation group backdrop-blur-sm hover:scale-110 hover:shadow-lg hover:shadow-purple-400/20 z-10'
                  >
                    <Plus className='h-4 w-4 sm:h-5 sm:w-5 text-purple-400 group-hover:text-purple-300 transition-colors' />
                  </button>

                  {/* Multi-line textarea */}
                  <Textarea
                    disabled={isLoading}
                    className='pl-16 sm:pl-20 pr-32 sm:pr-36 py-4 sm:py-5 bg-gradient-to-r from-gray-800/80 to-gray-700/80 border border-gray-600/30 focus-visible:ring-2 focus-visible:ring-purple-400/50 focus-visible:border-purple-400/50 focus-visible:ring-offset-0 text-white placeholder:text-gray-400 text-sm sm:text-base rounded-xl sm:rounded-2xl min-h-[52px] sm:min-h-[56px] max-h-[200px] touch-manipulation backdrop-blur-sm transition-all duration-300 hover:border-gray-500/50 resize-none overflow-y-auto'
                    placeholder='Share a track record update... (Shift+Enter for new line)'
                    autoComplete='off'
                    spellCheck={true}
                    autoCorrect='on'
                    autoCapitalize='sentences'
                    onKeyDown={handleKeyDown}
                    rows={1}
                    style={{
                      resize: 'none',
                      overflow: 'hidden',
                    }}
                    onChange={e => {
                      // Auto-resize functionality
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = `${Math.min(target.scrollHeight, 200)}px`;

                      // Reset height if content is cleared
                      if (e.target.value === '') {
                        target.style.height = '52px';
                      }

                      // Update form field
                      field.onChange(e);
                    }}
                    value={field.value}
                    name={field.name}
                  />

                  {/* Right side buttons */}
                  <div className='absolute top-1/2 -translate-y-1/2 right-6 sm:right-8 flex items-center gap-2'>
                    {/* Emoji Button */}
                    <div className='h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-br from-gray-700/50 to-gray-600/50 border border-gray-600/30 backdrop-blur-sm hover:from-purple-600/20 hover:to-blue-600/20 hover:border-purple-400/50 transition-all duration-300 hover:scale-110 flex items-center justify-center group z-10'>
                      <EmojiPicker
                        onChange={value =>
                          form.setValue('content', field.value + ' ' + value)
                        }
                      />
                    </div>

                    {/* Send Button */}
                    <Button
                      type='submit'
                      disabled={isLoading || !field.value.trim()}
                      className='h-9 w-9 sm:h-10 sm:w-10 p-0 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 border border-purple-400/30 hover:border-purple-400/50 transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-purple-400/20 touch-manipulation disabled:opacity-50 disabled:hover:scale-100'
                    >
                      <Send className='h-4 w-4 sm:h-5 sm:w-5' />
                    </Button>
                  </div>

                  {/* Helper text */}
                  <div className='absolute bottom-1 right-6 sm:right-8 text-xs text-gray-400/70'>
                    Enter to send • Shift+Enter for new line
                  </div>
                </div>
              </FormControl>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
