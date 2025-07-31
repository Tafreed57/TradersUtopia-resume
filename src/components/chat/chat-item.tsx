'use client';

import { ActionTooltip } from '@/components/ui/action-tooltip';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/user/user-avatar';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/store';
import { zodResolver } from '@hookform/resolvers/zod';
import { Member, Role, User } from '@prisma/client';
import { secureAxiosPatch } from '@/lib/csrf-client';
import { Edit, FileText, ShieldAlert, ShieldCheck, Trash } from 'lucide-react';
import NextImage from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import qs from 'query-string';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import z from 'zod';

interface ChatItemProps {
  id: string;
  content: string;
  member: Member & {
    user: User;
    role: Role;
  };
  timestamp: string;
  fileUrl: string | null;
  deleted: boolean;
  currentMember: Member & {
    user: User;
    role: Role;
  };
  isUpdated: boolean;
  socketUrl: string;
  socketQuery: Record<string, string>;
}

const roleIconMap: Record<string, React.ReactNode> = {
  free: null,
  premium: <ShieldCheck className='w-4 ml-2 h-4 text-indigo-500' />,
  // For backwards compatibility, also support these role names
  GUEST: null,
  ADMIN: <ShieldAlert className='w-4 h-4 ml-2 text-rose-500' />,
  MODERATOR: <ShieldCheck className='w-4 ml-2 h-4 text-indigo-500' />,
};

const formSchema = z.object({
  content: z.string().min(1),
});

export function ChatItem({
  id,
  content,
  member,
  timestamp,
  fileUrl,
  deleted,
  currentMember,
  isUpdated,
  socketUrl,
  socketQuery,
}: ChatItemProps) {
  const onOpen = useStore(state => state.onOpen);
  const params = useParams();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const fileType = fileUrl?.split('.').pop();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: content,
    },
  });

  const isLoading2 = form.formState.isSubmitting;

  // Check if user is admin based on User.isAdmin field
  const isAdmin = currentMember.user.isAdmin;
  const isModerator = currentMember.role.name === 'premium'; // Premium users might have moderation rights
  const isOwner = currentMember.id === member.id;
  const canDeleteMessage = !deleted && (isAdmin || isModerator || isOwner);
  const canEditMessage = !deleted && isOwner && !fileUrl;
  const isPDF = fileType === 'pdf';
  const isImage = !isPDF && fileUrl;

  useEffect(() => {
    form.reset({
      content: content,
    });
  }, [content, form]);

  useEffect(() => {
    const handleKeyDown = (event: any) => {
      if (event.key === 'Escape' || event.keyCode === 27) {
        setIsEditing(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const url = `/api/servers/${socketQuery.serverId}/channels/${socketQuery.channelId}/messages/${id}`;

      await secureAxiosPatch(url, values);
      form.reset();
      setIsEditing(false);

      router.refresh();
    } catch (error) {}
  };

  return (
    <div className='relative group flex items-start hover:bg-black/5 p-3 sm:p-4 transition w-full touch-manipulation'>
      <div className='group flex gap-x-2 sm:gap-x-3 items-start w-full'>
        <div className='flex-shrink-0'>
          <UserAvatar
            src={member.user.imageUrl ?? undefined}
            className='h-8 w-8 sm:h-10 sm:w-10'
          />
        </div>
        <div className='flex flex-col w-full min-w-0'>
          <div className='flex items-center gap-x-2 flex-wrap'>
            <div className='flex items-center gap-x-1'>
              <div className='font-semibold text-sm sm:text-base text-white truncate'>
                {member.user.name}
              </div>
              <ActionTooltip label={member.role.name}>
                {roleIconMap[member.role.name] ||
                  roleIconMap[member.role.name.toUpperCase()]}
              </ActionTooltip>
            </div>
            <span className='text-xs text-gray-400 flex-shrink-0'>
              {timestamp}
            </span>
          </div>
          {isImage && (
            <a
              href={fileUrl}
              target='_blank'
              rel='noreferrer noopener'
              className='relative rounded-md mt-2 overflow-hidden border flex items-center bg-secondary h-32 w-32 sm:h-40 sm:w-40 md:h-48 md:w-48 touch-manipulation'
            >
              <NextImage
                src={fileUrl}
                alt={content}
                fill
                className='object-cover'
              />
            </a>
          )}
          {isPDF && (
            <a
              href={fileUrl || ''}
              target='_blank'
              rel='noreferrer noopener'
              className='relative rounded-md mt-2 overflow-hidden border flex items-center bg-secondary/20 h-20 p-2 hover:bg-secondary/30 transition-colors'
            >
              <FileText className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-gray-400 m-auto' />
            </a>
          )}
          {!fileUrl && !isEditing && (
            <div
              className={cn(
                'text-sm sm:text-base text-gray-200 break-words',
                deleted && 'italic text-gray-400 text-xs sm:text-sm mt-1'
              )}
            >
              {deleted ? (
                <span className='italic'>{content}</span>
              ) : (
                <MarkdownRenderer content={content} />
              )}
              {isUpdated && !deleted && (
                <span className='text-[10px] sm:text-xs text-gray-400 ml-1'>
                  (edited)
                </span>
              )}
            </div>
          )}
          {!fileUrl && isEditing && (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className='flex flex-col sm:flex-row sm:items-center w-full gap-2 pt-2'
              >
                <FormField
                  control={form.control}
                  name='content'
                  render={({ field }) => (
                    <FormItem className='flex-1'>
                      <FormControl>
                        <div className='relative w-full'>
                          <Textarea
                            disabled={isLoading2}
                            className='p-2 sm:p-3 bg-zinc-200/90 border-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-zinc-800 text-sm sm:text-base min-h-[44px] touch-manipulation resize-none'
                            placeholder='Edited Message'
                            autoComplete='off'
                            spellCheck={true}
                            autoCorrect='on'
                            autoCapitalize='sentences'
                            rows={1}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                form.handleSubmit(onSubmit)();
                              }
                              if (e.key === 'Escape') {
                                setIsEditing(false);
                              }
                            }}
                            onInput={e => {
                              // Auto-resize functionality
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              target.style.height = `${Math.min(
                                target.scrollHeight,
                                200
                              )}px`;
                            }}
                            {...field}
                          />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button
                  disabled={isLoading2}
                  size='sm'
                  variant='default'
                  className='min-h-[44px] px-4 touch-manipulation'
                >
                  Save
                </Button>
              </form>
              <div className='mt-1 text-[10px] sm:text-xs text-gray-400'>
                Press escape to cancel • Enter to save • Shift+Enter for new
                line
              </div>
            </Form>
          )}
        </div>
      </div>
      {canDeleteMessage && (
        <div className='hidden group-hover:flex items-center gap-x-1 sm:gap-x-2 absolute p-1 -top-2 right-3 sm:right-5 bg-gradient-to-r from-gray-800/95 via-gray-700/95 to-gray-800/95 backdrop-blur-xl border border-gray-600/50 rounded-lg shadow-2xl'>
          {canEditMessage && (
            <ActionTooltip label='Edit'>
              <Edit
                onClick={() => setIsEditing(true)}
                className='cursor-pointer w-4 h-4 text-gray-400 hover:text-white transition touch-manipulation'
              />
            </ActionTooltip>
          )}
          <ActionTooltip label='Delete'>
            <Trash
              onClick={() =>
                onOpen('deleteMessage', {
                  apiUrl: `${socketUrl}/${id}`,
                  query: socketQuery,
                })
              }
              className='cursor-pointer w-4 h-4 text-gray-400 hover:text-red-400 transition touch-manipulation'
            />
          </ActionTooltip>
        </div>
      )}
    </div>
  );
}
