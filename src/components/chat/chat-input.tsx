'use client';

import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import z from 'zod';
import { secureAxiosPost } from '@/lib/csrf-client';
import qs from 'query-string';
import { useStore } from '@/store/store';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { Member, MemberRole } from '@prisma/client';

interface ChatInputProps {
  apiUrl: string;
  query: Record<string, any>;
  name: string;
  type: 'channel';
  member: Member;
}

const formSchema = z.object({
  content: z.string().min(1),
});

export function ChatInput({
  apiUrl,
  query,
  name,
  type,
  member,
}: ChatInputProps) {
  const onOpen = useStore.use.onOpen();

  // ✅ FIX: Move useForm hook call BEFORE any conditional returns
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: '',
    },
  });
  const isLoading = form.formState.isSubmitting;

  // ✅ PERMISSION CHECK: Only MODERATOR and ADMIN can send messages
  // GUEST users get no chat input at all (completely hidden)
  if (member.role === MemberRole.GUEST) {
    return null;
  }

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const url = qs.stringifyUrl({
        url: apiUrl,
        query,
      });

      // ✅ OPTIMIZATION: Remove router.refresh() to eliminate expensive page reloads
      // The chat will update via other mechanisms (React Query, sockets, etc.)
      await secureAxiosPost(url, values);
      form.reset();

      // ✅ RESET: Find and reset textarea height after sending
      const textarea = document.querySelector(
        'textarea[name="content"]'
      ) as HTMLTextAreaElement;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = '52px';
      }

      // ✅ PERFORMANCE: Removed router.refresh() - this was causing the slow message sending
      // Messages will appear via React Query refetch or real-time updates
    } catch (error) {
      console.log(error);
    }
  };

  // Handle keyboard events for multi-line input
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.handleSubmit(onSubmit)();

      // ✅ RESET: Also reset height on Enter press (backup for immediate UI feedback)
      setTimeout(() => {
        const textarea = event.target as HTMLTextAreaElement;
        if (textarea) {
          textarea.style.height = '52px';
        }
      }, 100); // Small delay to allow form reset to complete
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
                  <div className='absolute inset-0 bg-gradient-to-r from-blue-900/5 via-transparent to-purple-900/5 pointer-events-none' />

                  {/* Add Media Button - vertically centered */}
                  <button
                    type='button'
                    onClick={() => onOpen('messageFile', { apiUrl, query })}
                    className='absolute top-1/2 -translate-y-1/2 left-6 sm:left-8 h-9 w-9 sm:h-10 sm:w-10 bg-gradient-to-br from-blue-600/20 to-purple-600/20 hover:from-blue-600/30 hover:to-purple-600/30 border border-blue-400/30 hover:border-blue-400/50 transition-all duration-300 rounded-xl flex items-center justify-center touch-manipulation group backdrop-blur-sm hover:scale-110 hover:shadow-lg hover:shadow-blue-400/20 z-10'
                  >
                    <Plus className='h-4 w-4 sm:h-5 sm:w-5 text-blue-400 group-hover:text-blue-300 transition-colors' />
                  </button>

                  {/* Multi-line textarea with proper padding for buttons */}
                  <Textarea
                    disabled={isLoading}
                    className='pl-16 sm:pl-20 pr-16 sm:pr-20 py-4 sm:py-5 bg-gradient-to-r from-gray-800/80 to-gray-700/80 border border-gray-600/30 focus-visible:ring-2 focus-visible:ring-blue-400/50 focus-visible:border-blue-400/50 focus-visible:ring-offset-0 text-white placeholder:text-gray-400 text-sm sm:text-base rounded-xl sm:rounded-2xl min-h-[52px] sm:min-h-[56px] max-h-[200px] touch-manipulation backdrop-blur-sm transition-all duration-300 hover:border-gray-500/50 resize-none overflow-y-auto'
                    placeholder={`Message #${name} (Shift+Enter for new line)`}
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

                  {/* Emoji Button - vertically centered */}
                  <div className='absolute top-1/2 -translate-y-1/2 right-6 sm:right-8'>
                    <div className='h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-br from-gray-700/50 to-gray-600/50 border border-gray-600/30 backdrop-blur-sm hover:from-purple-600/20 hover:to-pink-600/20 hover:border-purple-400/50 transition-all duration-300 hover:scale-110 flex items-center justify-center group z-10'>
                      <EmojiPicker
                        onChange={value =>
                          form.setValue('content', field.value + ' ' + value)
                        }
                      />
                    </div>
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
