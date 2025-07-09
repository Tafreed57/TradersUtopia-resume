'use client';

import { TrackRecordHeader } from '@/components/track-record/track-record-header';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Send, Upload, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import z from 'zod';
import { secureAxiosPost } from '@/lib/csrf-client';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  content: z.string().min(1),
});

// ✅ STANDALONE: No Zustand store dependencies
export function TrackRecordStandalone() {
  const { userId, isLoaded } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: '',
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  useEffect(() => {
    if (!isLoaded) return;

    let isMounted = true;

    const loadData = async () => {
      try {
        // Fetch messages first (always available)
        const messagesResponse = await fetch('/api/track-record/messages');
        const messagesData = await messagesResponse.json();

        if (isMounted) {
          setMessages(messagesData.items || []);
        }

        // Check admin status if user is logged in
        if (userId) {
          const adminResponse = await fetch('/api/admin/check-status');
          const adminData = await adminResponse.json();

          if (isMounted) {
            setIsAdmin(adminData.isAdmin);
          }
        } else {
          if (isMounted) {
            setIsAdmin(false);
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
        if (isMounted) {
          setIsAdmin(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isLoaded, userId]);

  const refreshMessages = async () => {
    try {
      const response = await fetch('/api/track-record/messages');
      const data = await response.json();
      setMessages(data.items || []);
    } catch (error) {
      console.error('Error refreshing messages:', error);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const formData = new FormData();
      formData.append('content', values.content);

      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      const response = await fetch('/api/track-record/messages', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        form.reset();
        setSelectedFile(null);
        setShowFileUpload(false);

        // Reset textarea height
        const textarea = document.querySelector(
          'textarea[name="content"]'
        ) as HTMLTextAreaElement;
        if (textarea) {
          textarea.style.height = 'auto';
          textarea.style.height = '52px';
        }

        // Refresh messages
        await refreshMessages();
      } else {
        throw new Error('Failed to post message');
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setShowFileUpload(true);
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

  // Don't render anything until auth is loaded
  if (!isLoaded || isLoading) {
    return (
      <div className='flex flex-col h-[600px] md:h-[700px] items-center justify-center'>
        <div className='flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-600/20 border border-purple-400/30 backdrop-blur-sm mb-4'>
          <Loader2 className='h-8 w-8 text-purple-400 animate-spin' />
        </div>
        <p className='text-sm text-gray-300'>Loading track record...</p>
      </div>
    );
  }

  return (
    <div className='flex flex-col h-[600px] md:h-[700px]'>
      <TrackRecordHeader />

      {/* Messages Display */}
      <div className='flex-1 flex flex-col py-4 overflow-y-auto'>
        {messages.length === 0 ? (
          <div className='flex-1 flex items-center justify-center'>
            <div className='text-center space-y-4 p-8'>
              <div className='w-16 h-16 bg-gradient-to-br from-purple-500/20 to-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4'>
                <div className='w-8 h-8 text-purple-400'>📊</div>
              </div>
              <h3 className='text-xl font-bold text-white'>
                Welcome to Our Track Record
              </h3>
              <p className='text-gray-300 max-w-md'>
                This is where our professional traders share real-time updates
                about their trading performance. Every trade, win or loss, is
                documented here with complete transparency.
              </p>
              <div className='text-center p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-xl border border-yellow-400/20'>
                <p className='text-sm text-gray-300'>
                  <span className='text-yellow-400 font-medium'>Note:</span>{' '}
                  Only our verified administrators can post updates to ensure
                  authenticity and accuracy.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className='space-y-4 px-4'>
            {messages.map(message => (
              <div
                key={message.id}
                className='bg-gray-800/50 rounded-lg p-4 border border-gray-700/30'
              >
                <div className='flex items-center gap-2 mb-2'>
                  <div className='w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center'>
                    <span className='text-white text-xs font-bold'>A</span>
                  </div>
                  <span className='text-white font-semibold'>
                    {message.admin.name}
                  </span>
                  <span className='text-red-400 text-xs font-medium'>
                    ADMIN
                  </span>
                  <span className='text-gray-400 text-xs ml-auto'>
                    {new Date(message.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className='text-gray-200 whitespace-pre-wrap'>
                  {message.content}
                </p>
                {message.fileUrl && (
                  <div className='mt-2'>
                    {message.fileUrl.includes('.pdf') ? (
                      <a
                        href={message.fileUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-blue-400 hover:text-blue-300 underline'
                      >
                        📄 View PDF
                      </a>
                    ) : (
                      <img
                        src={message.fileUrl}
                        alt='Track record attachment'
                        className='max-w-xs rounded-lg'
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ✅ STANDALONE ADMIN INPUT: No Zustand dependencies */}
      {isAdmin && (
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

                      {/* File Upload Section */}
                      {showFileUpload && (
                        <div className='mb-4 p-3 bg-gray-800/80 rounded-xl border border-gray-600/30'>
                          <div className='flex items-center justify-between mb-2'>
                            <span className='text-sm text-gray-300'>
                              Selected File:
                            </span>
                            <button
                              type='button'
                              onClick={() => {
                                setSelectedFile(null);
                                setShowFileUpload(false);
                              }}
                              className='text-gray-400 hover:text-white'
                            >
                              <X className='h-4 w-4' />
                            </button>
                          </div>
                          <div className='text-sm text-white'>
                            {selectedFile?.name}
                          </div>
                        </div>
                      )}

                      {/* Add Media Button */}
                      <div className='absolute top-1/2 -translate-y-1/2 left-6 sm:left-8'>
                        <input
                          type='file'
                          accept='image/*,.pdf'
                          onChange={handleFileSelect}
                          className='hidden'
                          id='file-upload'
                        />
                        <label
                          htmlFor='file-upload'
                          className='h-9 w-9 sm:h-10 sm:w-10 bg-gradient-to-br from-purple-600/20 to-blue-600/20 hover:from-purple-600/30 hover:to-blue-600/30 border border-purple-400/30 hover:border-purple-400/50 transition-all duration-300 rounded-xl flex items-center justify-center touch-manipulation group backdrop-blur-sm hover:scale-110 hover:shadow-lg hover:shadow-purple-400/20 z-10 cursor-pointer'
                        >
                          <Plus className='h-4 w-4 sm:h-5 sm:w-5 text-purple-400 group-hover:text-purple-300 transition-colors' />
                        </label>
                      </div>

                      {/* Multi-line textarea */}
                      <Textarea
                        disabled={isSubmitting}
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
                              form.setValue(
                                'content',
                                field.value + ' ' + value
                              )
                            }
                          />
                        </div>

                        {/* Send Button */}
                        <Button
                          type='submit'
                          disabled={isSubmitting || !field.value.trim()}
                          className='h-9 w-9 sm:h-10 sm:w-10 p-0 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 border border-purple-400/30 hover:border-purple-400/50 transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-purple-400/20 touch-manipulation disabled:opacity-50 disabled:hover:scale-100'
                        >
                          {isSubmitting ? (
                            <Loader2 className='h-4 w-4 sm:h-5 sm:w-5 animate-spin' />
                          ) : (
                            <Send className='h-4 w-4 sm:h-5 sm:w-5' />
                          )}
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
      )}
    </div>
  );
}
