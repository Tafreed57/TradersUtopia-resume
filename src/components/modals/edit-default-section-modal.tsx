'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useStore } from '@/store/store';
import { zodResolver } from '@hookform/resolvers/zod';
import { secureAxiosPost } from '@/lib/csrf-client';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useEffect } from 'react';
import qs from 'query-string';

export function EditDefaultSectionModal() {
  const router = useRouter();
  const params = useParams();
  const type = useStore.use.type();
  const isOpen = useStore.use.isOpen();
  const onClose = useStore.use.onClose();
  const data = useStore.use.data();

  const isModelOpen = isOpen && type === 'editDefaultSection';

  const schema = z.object({
    defaultSectionName: z
      .string()
      .min(1, { message: 'Section name is required' })
      .max(50, { message: 'Section name must be 50 characters or less' }),
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      defaultSectionName: '',
    },
  });

  const { register, handleSubmit, formState, watch } = form;

  const isLoading = formState.isSubmitting;

  // ✅ NEW: Set current default section name when modal opens
  useEffect(() => {
    if (data?.server) {
      const hasDefaultSectionName = (
        server: any
      ): server is { defaultSectionName: string } => {
        return server && 'defaultSectionName' in server;
      };

      const defaultName = hasDefaultSectionName(data.server)
        ? data.server.defaultSectionName
        : 'Text Channels';

      form.setValue('defaultSectionName', defaultName);
    }
  }, [data?.server, form]);

  const onSubmit = async (values: z.infer<typeof schema>) => {
    try {
      const url = qs.stringifyUrl({
        url: `/api/servers/${params?.serverId}/default-section`,
        query: {},
      });
      await secureAxiosPost(url, values);
      form.reset();
      router.refresh();
      onClose();
    } catch (error) {
      console.log('Default section edit error:', error);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isModelOpen} onOpenChange={handleClose}>
      <DialogContent className='bg-white text-black p-0 overflow-hidden'>
        <DialogHeader className='pt-8 px-6'>
          <DialogTitle className='text-2xl text-center font-bold'>
            Edit Default Section
          </DialogTitle>
          <DialogDescription className='text-center text-zinc-500'>
            Change the name of your default section for ungrouped channels
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className='space-y-8'>
            <div className='space-y-8 px-6'>
              <FormField
                control={form.control}
                name='defaultSectionName'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='uppercase text-xs font-bold text-zinc-500 dark:text-secondary/70'>
                      Default section name
                    </FormLabel>

                    <FormControl>
                      <Input
                        disabled={isLoading}
                        className='bg-zinc-300/50 border-0 focus-visible:ring-0 text-black focus-visible:ring-offset-0'
                        placeholder='Enter section name'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className='bg-gray-100 px-6 py-4'>
              <Button
                type='submit'
                variant='default'
                disabled={isLoading}
                className='w-full'
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
