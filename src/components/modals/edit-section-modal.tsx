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
import { secureAxiosPatch } from '@/lib/csrf-client';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useEffect } from 'react';

const schema = z.object({
  name: z.string().min(1, { message: 'Section name is required' }),
});

export function EditSectionModal() {
  const router = useRouter();
  const type = useStore(state => state.type);
  const isOpen = useStore(state => state.isOpen);
  const onClose = useStore(state => state.onClose);
  const data = useStore(state => state.data);

  const isModelOpen = isOpen && type === 'editSection';

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
    },
  });

  useEffect(() => {
    if (data?.section) {
      form.setValue('name', data.section.name);
    }
  }, [data?.section, form]);

  const isLoading = form.formState.isSubmitting;

  const onSubmit = async (values: z.infer<typeof schema>) => {
    try {
      const url = `/api/sections/${data?.section?.id}?serverId=${data?.server?.id}`;
      await secureAxiosPatch(url, values);

      form.reset();
      router.refresh();
      onClose();
    } catch (error) {
      //
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
            Edit Section
          </DialogTitle>
          <DialogDescription className='text-center text-zinc-500'>
            Change the name of your section
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
            <div className='space-y-8 px-6'>
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
                {isLoading ? 'Saving...' : 'Save Section'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
