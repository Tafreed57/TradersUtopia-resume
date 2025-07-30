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
import { secureAxiosPost } from '@/lib/csrf-client';
import { z } from 'zod';
import { FormModal } from './base';

const schema = z.object({
  name: z.string().min(1, { message: 'Section name is required' }),
});

export function CreateSectionModal() {
  const data = useStore(state => state.data);

  const onSubmit = async (values: z.infer<typeof schema>) => {
    const url = `/api/sections?serverId=${data?.server?.id}`;
    await secureAxiosPost(url, values);
  };

  return (
    <FormModal
      type='createSection'
      title='Create Section'
      description='Organize your channels into sections for better structure'
      schema={schema}
      defaultValues={{ name: '' }}
      onSubmit={onSubmit}
      submitText='Create Section'
    >
      {form => (
        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel className='uppercase text-xs font-bold text-zinc-500 dark:text-secondary/70'>
                Section name
              </FormLabel>
              <FormControl>
                <Input
                  className='bg-zinc-300/50 border-0 focus-visible:ring-0 text-black focus-visible:ring-offset-0'
                  placeholder='Enter section name'
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
