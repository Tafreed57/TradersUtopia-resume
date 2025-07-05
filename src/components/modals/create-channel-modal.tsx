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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useStore } from '@/store/store';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChannelType } from '@prisma/client';
import { secureAxiosPost } from '@/lib/csrf-client';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useEffect } from 'react';
import qs from 'query-string';

export function CreateChannelModal() {
  const router = useRouter();
  const params = useParams();
  const type = useStore.use.type();
  const isOpen = useStore.use.isOpen();
  const onClose = useStore.use.onClose();
  const data = useStore.use.data();

  const isModelOpen = isOpen && type === 'createChannel';

  const schema = z.object({
    name: z.string().min(1, { message: 'Channel name is required' }),
    sectionId: z.string().optional(),
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      sectionId: 'none',
    },
  });

  useEffect(() => {
    if (data?.section) {
      form.setValue('sectionId', data.section.id);
    } else {
      form.setValue('sectionId', 'none');
    }
  }, [data?.section, form]);

  const { register, handleSubmit, formState, watch } = form;

  const isLoading = formState.isSubmitting;

  const onSubmit = async (values: z.infer<typeof schema>) => {
    try {
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
      form.reset();
      router.refresh();
      onClose();
    } catch (error) {
      console.log(error);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const hasServerSections = (server: any): server is { sections: any[] } => {
    return server && 'sections' in server;
  };

  const availableSections = hasServerSections(data?.server)
    ? data.server.sections || []
    : [];

  return (
    <Dialog open={isModelOpen} onOpenChange={handleClose}>
      <DialogContent className='bg-white text-black p-0 overflow-hidden'>
        <DialogHeader className='pt-8 px-6'>
          <DialogTitle className='text-2xl text-center font-bold'>
            Create Channel
          </DialogTitle>
          <DialogDescription className='text-center text-zinc-500'>
            Create a new text channel for your server
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className='space-y-8'>
            <div className='space-y-8 px-6'>
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
                        disabled={isLoading}
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
                      <Select
                        disabled={isLoading}
                        onValueChange={field.onChange}
                        value={field.value}
                      >
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
            </div>
            <DialogFooter className='bg-gray-100 px-6 py-4'>
              <Button
                type='submit'
                variant='default'
                disabled={isLoading}
                className='w-full'
              >
                Create Channel
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
