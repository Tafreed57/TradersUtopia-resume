'use client';

import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Smile } from 'lucide-react';
import { useForm } from 'react-hook-form';
import z from 'zod';
import { secureAxiosPost } from '@/lib/csrf-client';
import qs from 'query-string';
import { useStore } from '@/store/store';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { useRouter } from 'next/navigation';
import { Member, MemberRole } from '@prisma/client';

interface ChatInputProps {
  apiUrl: string;
  query: Record<string, any>;
  name: string;
  type: 'conversation' | 'channel';
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
  const router = useRouter();
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
      await secureAxiosPost(url, values);
      form.reset();
      router.refresh();
    } catch (error) {
      console.log(error);
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
                <div className='relative p-3 sm:p-4 pb-4 sm:pb-6 bg-white dark:bg-[#313338] border-t border-neutral-200 dark:border-neutral-800'>
                  <button
                    type='button'
                    onClick={() => onOpen('messageFile', { apiUrl, query })}
                    className='absolute top-6 sm:top-7 left-6 sm:left-8 h-6 w-6 sm:h-7 sm:w-7 bg-zinc-500 dark:bg-zinc-400 hover:bg-zinc-600 dark:hover:bg-zinc-300 transition rounded-full p-1 flex items-center justify-center touch-manipulation'
                  >
                    <Plus className='h-3 w-3 sm:h-4 sm:w-4 text-white dark:text-[#313338]' />
                  </button>
                  <Input
                    disabled={isLoading}
                    className='px-12 sm:px-14 py-3 sm:py-4 md:py-6 bg-zinc-200/90 dark:bg-zinc-700/75 border-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-zinc-600 dark:text-zinc-200 text-sm sm:text-base rounded-lg sm:rounded-xl min-h-[44px] touch-manipulation'
                    placeholder={`Message ${type === 'conversation' ? name : '#' + name}`}
                    autoComplete='off'
                    spellCheck={false}
                    autoCorrect='off'
                    autoCapitalize='off'
                    {...field}
                  />
                  <div className='absolute top-6 sm:top-7 right-6 sm:right-8'>
                    <EmojiPicker
                      onChange={value =>
                        form.setValue('content', field.value + ' ' + value)
                      }
                    />
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
