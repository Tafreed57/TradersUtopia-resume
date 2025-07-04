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
import { zodResolver } from '@hookform/resolvers/zod';
import { secureAxiosPost } from '@/lib/csrf-client';
import NextImage from 'next/image';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useStore } from '@/store/store';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function CreateServerModal() {
  const router = useRouter();
  const type = useStore.use.type();
  const isOpen = useStore.use.isOpen();
  const onClose = useStore.use.onClose();
  const [uploadError, setUploadError] = useState<string | null>(null);

  const isModelOpen = isOpen && type === 'createServer';

  const schema = z.object({
    name: z.string().min(1, { message: 'Server name is required' }),
    imageUrl: z.string().min(1, { message: 'Server image is required' }),
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      imageUrl: '',
    },
  });

  const { register, handleSubmit, formState, watch } = form;

  const isLoading = formState.isSubmitting;

  const onSubmit = async (values: z.infer<typeof schema>) => {
    console.log('🚀 [SERVER] Submitting server creation:', values);
    try {
      await secureAxiosPost('/api/servers', values);
      form.reset();
      router.refresh();
      onClose();
      setUploadError(null);
    } catch (error) {
      console.error('❌ [SERVER] Server creation failed:', error);
    }
  };

  const handleClose = () => {
    form.reset();
    setUploadError(null);
    onClose();
  };

  return (
    <Dialog open={isModelOpen} onOpenChange={handleClose}>
      <DialogContent className='bg-white text-black p-0 overflow-hidden'>
        <DialogHeader className='pt-8 px-6'>
          <DialogTitle className='text-2xl text-center font-bold'>
            Customize your server
          </DialogTitle>
          <DialogDescription className='text-center text-zinc-500'>
            Give your server a personality with a name and an image. You can
            always change it later.
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
                              objectFit='cover'
                              src={field.value}
                              className='rounded-full'
                              alt='Server Image'
                            />
                            <Button
                              onClick={() => {
                                field.onChange('');
                                setUploadError(null);
                              }}
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
                          <div className='space-y-2'>
                            <UploadDropzone
                              className='mt-4 focus-visible:outline-zinc-700
													focus-visible:outline-dashed
													ut-button:bg-indigo-500 ut-button:text-white ut-button:hover:bg-indigo-500/90 ut-button:ut-readying:bg-indigo-500/90 ut-button:ut-uploading:bg-indigo-500/90 ut-button:after:bg-indigo-700
													ut-label:text-zinc-700 ut-allowed-content:text-zinc-500
												'
                              endpoint='serverImage'
                              onClientUploadComplete={res => {
                                console.log(
                                  '✅ [UPLOAD] Upload completed:',
                                  res
                                );
                                if (res && res[0]) {
                                  field.onChange(res[0].url);
                                  setUploadError(null);
                                  console.log(
                                    '🎉 [UPLOAD] Image URL set:',
                                    res[0].url
                                  );
                                }
                              }}
                              onUploadError={(error: Error) => {
                                console.error(
                                  '❌ [UPLOAD] Upload error:',
                                  error
                                );
                                setUploadError(error.message);
                              }}
                              onUploadBegin={name => {
                                console.log(
                                  '📤 [UPLOAD] Upload starting:',
                                  name
                                );
                                setUploadError(null);
                              }}
                              onUploadProgress={progress => {
                                console.log(
                                  '📊 [UPLOAD] Progress:',
                                  progress + '%'
                                );
                              }}
                            />
                            {uploadError && (
                              <div className='text-red-500 text-sm text-center p-2 bg-red-50 rounded'>
                                Upload Error: {uploadError}
                              </div>
                            )}
                            <div className='text-xs text-gray-500 text-center'>
                              💡 Tip: Make sure you're signed in and try a
                              different image if upload fails
                            </div>
                          </div>
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
                    <FormLabel className='uppercase text-xs font-bold text-zinc-500 dark:text-secondary/70'>
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
            <DialogFooter className='bg-gray-100 px-6 py-4'>
              <Button disabled={isLoading} variant='default'>
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
