'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useStore } from '@/store/store';
import { ChannelType } from '@prisma/client';
import { z } from 'zod';
import { FormModal } from './base';

export function EditChannelModal() {
  const data = useStore(state => state.data);

  const schema = z.object({
    name: z.string().min(1, { message: 'Channel name is required' }),
  });

  const onSubmit = async (values: z.infer<typeof schema>) => {
    // Use new server-based endpoint structure
    const url = `/api/servers/${data?.server?.id}/channels/${data?.channel?.id}`;
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...values, type: ChannelType.TEXT }),
    });
  };

  // Get initial values from the channel data
  const getDefaultValues = () => {
    return {
      name: data?.channel?.name || '',
    };
  };

  return (
    <FormModal
      type='editChannel'
      title='Edit Channel'
      description='Update the channel name and settings.'
      schema={schema}
      defaultValues={getDefaultValues()}
      onSubmit={onSubmit}
      submitText='Save'
    >
      {form => (
        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel className='uppercase text-xs font-bold text-zinc-500 dark:text-secondary/70'>
                Channel name
              </FormLabel>
              <FormControl>
                <Input
                  className='bg-zinc-300/50 border-0 focus-visible:ring-0 text-black focus-visible:ring-offset-0'
                  placeholder='Enter Channel name'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </FormModal>
  );
}
