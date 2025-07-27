'use client';

import {
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
import { z } from 'zod';
import { FormModal } from './base';

const formSchema = z.object({
  content: z.string().min(1, 'Content is required').max(4000),
});

export function EditTrackRecordMessageModal() {
  const router = useRouter();
  const data = useStore(state => state.data);

  const handleEdit = async (values: z.infer<typeof formSchema>) => {
    await secureAxiosPatch(`/api/track-record/messages/${data?.message?.id}`, {
      content: values.content,
    });

    // Refresh the page to update the messages
    router.refresh();

    // Also trigger a custom event to refresh the track record component
    window.dispatchEvent(new CustomEvent('trackRecordRefresh'));
  };

  // Get initial values from message data
  const getDefaultValues = () => {
    return {
      content: data?.message?.content || '',
    };
  };

  return (
    <FormModal
      type='editTrackRecordMessage'
      title='Edit Track Record Message'
      description='Update your track record message. This will be visible to all users.'
      schema={formSchema}
      defaultValues={getDefaultValues()}
      onSubmit={handleEdit}
      submitText='Save Changes'
    >
      {form => (
        <>
          <FormField
            control={form.control}
            name='content'
            render={({ field }) => (
              <FormItem>
                <FormLabel className='text-sm font-medium'>
                  Message Content
                </FormLabel>
                <FormControl>
                  <Textarea
                    className='bg-zinc-300/50 border-0 focus-visible:ring-0 text-black focus-visible:ring-offset-0 min-h-[120px] max-h-[300px] resize-none'
                    placeholder='Share your track record update...'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='bg-blue-50 rounded-lg p-3 border border-blue-200'>
            <div className='flex items-center gap-2 mb-1'>
              <div className='w-2 h-2 bg-blue-500 rounded-full'></div>
              <span className='text-blue-700 font-medium text-sm'>Notice</span>
            </div>
            <p className='text-xs text-blue-600'>
              This message will be marked as edited and the timestamp will be
              updated.
            </p>
          </div>
        </>
      )}
    </FormModal>
  );
}
