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
  FormMessage,
} from '@/components/ui/form';
import { UploadDropzone } from '@/lib/uploadthing';
import { zodResolver } from '@hookform/resolvers/zod';
import NextImage from 'next/image';
import qs from 'query-string';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useStore } from '@/store/store';
import { FileIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function MessageFileModal() {
  const type = useStore(state => state.type);
  const isOpen = useStore(state => state.isOpen);
  const onClose = useStore(state => state.onClose);
  const data = useStore(state => state.data);
  const router = useRouter();
  const queryClient = useQueryClient();

  const isModalOpen = isOpen && type === 'messageFile';
  const [uploadError, setUploadError] = useState<string | null>(null);

  const schema = z.object({
    fileUrl: z.string().min(1, { message: 'Attachment is required' }),
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      fileUrl: '',
    },
  });

  const { register, handleSubmit, formState, watch } = form;

  const isLoading = formState.isSubmitting;

  const onSubmit = async (values: z.infer<typeof schema>) => {
    try {
      const url = qs.stringifyUrl({
        url: data?.apiUrl || '',
        query: data?.query,
      });

      console.log('💬 [MESSAGE] Sending file message:', values);
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...values, content: values.fileUrl }),
      });
      form.reset();
      router.refresh();
      handleClose();
    } catch (error) {
      console.error('❌ [MESSAGE] File message failed:', error);
    }
  };

  const handleClose = () => {
    form.reset();
    setUploadError(null);
    onClose();
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className='bg-white text-black p-0 overflow-hidden'>
        <DialogHeader className='pt-8 px-6'>
          <DialogTitle className='text-2xl text-center font-bold'>
            Add an attachment
          </DialogTitle>
          <DialogDescription className='text-center text-zinc-500'>
            Send a file as a message
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
            <div className='space-y-8 px-6'>
              <div className='flex items-center justify-center text-center'>
                <FormField
                  control={form.control}
                  name='fileUrl'
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        {field?.value ? (
                          <div className='relative flex items-center p-2 mt-2 rounded-md bg-background/10'>
                            {field.value.split('.').pop() === 'pdf' ? (
                              <FileIcon className='h-10 w-10 fill-indigo-200 stroke-indigo-400' />
                            ) : (
                              <div className='relative h-20 w-20'>
                                <NextImage
                                  fill
                                  src={field.value}
                                  alt='Upload'
                                  className='rounded-md object-cover'
                                />
                              </div>
                            )}
                            <Button
                              onClick={() => {
                                field.onChange('');
                                setUploadError(null);
                              }}
                              className='bg-rose-500 text-white p-1 rounded-full absolute -top-2 -right-2 shadow-sm'
                              type='button'
                            >
                              <svg
                                xmlns='http://www.w3.org/2000/svg'
                                className='h-4 w-4'
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
                              endpoint='messageFile'
                              onClientUploadComplete={res => {
                                console.log(
                                  '✅ [FILE-UPLOAD] Upload completed:',
                                  res
                                );
                                if (res && res[0]) {
                                  field.onChange(res[0].url);
                                  setUploadError(null);
                                  console.log(
                                    '📎 [FILE-UPLOAD] File URL set:',
                                    res[0].url
                                  );
                                }
                              }}
                              onUploadError={(error: Error) => {
                                console.error(
                                  '❌ [FILE-UPLOAD] Upload error:',
                                  error
                                );
                                setUploadError(error.message);
                              }}
                              onUploadBegin={name => {
                                console.log(
                                  '📤 [FILE-UPLOAD] Upload starting:',
                                  name
                                );
                                setUploadError(null);
                              }}
                              onUploadProgress={progress => {
                                console.log(
                                  '📊 [FILE-UPLOAD] Progress:',
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
                              💡 Supports images and PDFs. Make sure you're
                              signed in.
                            </div>
                          </div>
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <DialogFooter className='bg-gray-100 px-6 py-4'>
              <Button disabled={isLoading} variant='default'>
                Send
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
