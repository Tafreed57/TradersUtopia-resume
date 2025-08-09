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
import { z } from 'zod';
import { FormModal } from './base';

const schema = z.object({
  name: z.string().min(1, { message: 'Section name is required' }),
});

export function EditSectionModal() {
  const data = useStore(state => state.data);

  const onSubmit = async (values: z.infer<typeof schema>) => {
    const url = `/api/servers/${data?.server?.id}/sections/${data?.section?.id}`;
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(values),
    });
  };

  // Get initial values from the section data
  const getDefaultValues = () => {
    return {
      name: data?.section?.name || '',
    };
  };

  return (
    <FormModal
      type='editSection'
      title='Edit Section'
      description='Change the name of your section'
      schema={schema}
      defaultValues={getDefaultValues()}
      onSubmit={onSubmit}
      submitText='Save Section'
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
