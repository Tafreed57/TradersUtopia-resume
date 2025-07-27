'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useStore } from '@/store/store';
import { ChannelType } from '@prisma/client';
import { secureAxiosPost } from '@/lib/csrf-client';
import { useParams } from 'next/navigation';
import { z } from 'zod';
import { useEffect } from 'react';
import qs from 'query-string';
import { FormModal } from './base';

export function CreateChannelModal() {
  const params = useParams();
  const data = useStore(state => state.data);

  const schema = z.object({
    name: z.string().min(1, { message: 'Channel name is required' }),
    sectionId: z.string().optional(),
  });

  const onSubmit = async (values: z.infer<typeof schema>) => {
    const url = qs.stringifyUrl({
      url: '/api/channels',
      query: {
        serverId: params?.serverId,
      },
    });

    const payload = {
      ...values,
      type: ChannelType.TEXT,
      sectionId: values.sectionId === 'none' ? null : values.sectionId,
    };

    await secureAxiosPost(url, payload);
  };

  const hasServerSections = (server: any): server is { sections: any[] } => {
    return server && 'sections' in server;
  };

  const availableSections = hasServerSections(data?.server)
    ? data.server.sections || []
    : [];

  // Get initial values with section pre-selected if passed in modal data
  const getDefaultValues = () => {
    return {
      name: '',
      sectionId: data?.section?.id || 'none',
    };
  };

  return (
    <FormModal
      type='createChannel'
      title='Create Channel'
      description='Create a new text channel for your server'
      schema={schema}
      defaultValues={getDefaultValues()}
      onSubmit={onSubmit}
      submitText='Create Channel'
    >
      {form => (
        <>
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
                    placeholder='Enter channel name'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {availableSections.length > 0 && (
            <FormField
              control={form.control}
              name='sectionId'
              render={({ field }) => (
                <FormItem>
                  <FormLabel className='uppercase text-xs font-bold text-zinc-500 dark:text-secondary/70'>
                    Section (Optional)
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className='bg-zinc-300/50 border-0 focus:ring-0 text-black ring-offset-0 focus:ring-offset-0 outline-none'>
                        <SelectValue placeholder='Select a section (optional)' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='none'>No Section</SelectItem>
                      {availableSections.map((section: any) => (
                        <SelectItem key={section.id} value={section.id}>
                          {section.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </>
      )}
    </FormModal>
  );
}
