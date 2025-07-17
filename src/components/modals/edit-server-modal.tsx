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
import { UploadDropzone } from '@/lib/uploadthing';
import { useStore } from '@/store/store';
import { zodResolver } from '@hookform/resolvers/zod';
import { secureAxiosPatch } from '@/lib/csrf-client';
import NextImage from 'next/image';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function EditServerModal() {
  const router = useRouter();
  const type = useStore(state => state.type);
  const isOpen = useStore(state => state.isOpen);
  const onClose = useStore(state => state.onClose);
  const data = useStore(state => state.data);

  const isModelOpen = isOpen && type === 'editServer';

  const schema = z.object({
    name: z.string().min(1, { message: 'Server name is required' }),
    imageUrl: z.string().min(1, { message: 'Server image is required' }),
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      imageUrl: '',
    },
  });

  useEffect(() => {
    if (data?.server) {
      form.setValue('name', data?.server?.name || '');
      form.setValue('imageUrl', data?.server?.imageUrl || '');
    }
  }, [data?.server, form]);

  const isLoading = form.formState.isSubmitting;

  const onSubmit = async (values: z.infer<typeof schema>) => {
    if (!data?.server?.id) {
      console.error('No server ID found');
      return;
    }

    try {
      await secureAxiosPatch(`/api/servers/${data.server.id}`, values);
      form.reset();
      router.refresh();
      onClose();
    } catch (error: any) {
      console.error(
        'Error updating server:',
        error.response?.data || error.message
      );
    }
  };
  const handleClose = () => {
    form.reset();
    onClose();
  };
  return (
    <Dialog open={isModelOpen} onOpenChange={handleClose}>
      <DialogContent className='bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl border border-gray-700/50 text-white p-0 overflow-hidden'>
        <DialogHeader className='pt-8 px-6'>
          <DialogTitle className='text-2xl text-center font-bold'>
            Customize your server
          </DialogTitle>
          <DialogDescription className='text-center text-zinc-500'>
            Give your sever a personality with a name and an image. You can
            always change these later.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
            <div className='space-y-8 px-6'>
              <div className='flex items-center justify-center text-center'>
                <FormField
                  control={form.control}
                  name='imageUrl'
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        {field?.value &&
                        field?.value?.split('.').pop() !== 'pdf' ? (
                          <div className='relative h-20 w-20'>
                            <NextImage
                              fill
                              src={field.value}
                              className='rounded-full object-cover'
                              alt='Server Image'
                              sizes='80px'
                            />
                            <Button
                              onClick={() => field.onChange('')}
                              type='button'
                              className='w-7 h-7 p-[.35rem] absolute bg-rose-500 hover:bg-rose-800 text-white top-0 right-0 rounded-full shadow-sm'
                            >
                              <svg
                                xmlns='http://www.w3.org/2000/svg'
                                className='h-6 w-6'
                                fill='none'
                                viewBox='0 0 24 24'
                                stroke='currentColor'
                              >
                                <path
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  strokeWidth={2}
                                  d='M6 18L18 6M6 6l12 12'
                                />
                              </svg>
                            </Button>
                          </div>
                        ) : (
                          <UploadDropzone
                            className='mt-4 focus-visible:outline-zinc-700
													focus-visible:outline-dashed
													ut-button:bg-indigo-500 ut-button:text-white ut-button:hover:bg-indigo-500/90 ut-button:ut-readying:bg-indigo-500/90 ut-button:ut-uploading:bg-indigo-500/90 ut-button:after:bg-indigo-700
													ut-label:text-zinc-700 ut-allowed-content:text-zinc-500
												'
                            endpoint='serverImage'
                            onClientUploadComplete={res => {
                              field.onChange(res?.[0].url);

                              alert('Upload Completed');
                            }}
                            onUploadError={(error: Error) => {
                              alert(`ERROR! ${error.message}`);
                            }}
                            onUploadBegin={name => {
                              // Do something once upload begins
                            }}
                          />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='uppercase text-xs font-bold text-zinc-500'>
                      Server name
                    </FormLabel>

                    <FormControl>
                      <Input
                        disabled={isLoading}
                        className='bg-zinc-300/50 border-0 focus-visible:ring-0 text-black focus-visible:ring-offset-0'
                        placeholder='Enter server name'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className='bg-gradient-to-r from-gray-800/80 via-gray-700/80 to-gray-800/80 backdrop-blur-sm border-t border-gray-700/50 px-6 py-4'>
              <Button
                type='submit'
                variant='default'
                disabled={isLoading}
                className='w-full'
              >
                {isLoading ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
