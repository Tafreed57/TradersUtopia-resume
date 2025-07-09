'use client';

import { UploadDropzone } from '@/lib/uploadthing';
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
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/store';
import { secureAxiosPost } from '@/lib/csrf-client';
import { useQueryClient } from '@tanstack/react-query';
import { FileIcon } from 'lucide-react';
import NextImage from 'next/image';
import { useState } from 'react';

const formSchema = z.object({
  fileUrl: z.string().min(1, {
    message: 'Attachment is required.',
  }),
});

export function TrackRecordFileModal() {
  const type = useStore(state => state.type);
  const isOpen = useStore(state => state.isOpen);
  const onClose = useStore(state => state.onClose);
  const data = useStore(state => state.data);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [uploadError, setUploadError] = useState<string | null>(null);

  const isModalOpen = isOpen && type === 'trackRecordFile';
  const { apiUrl } = data;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fileUrl: '',
    },
  });

  const handleClose = () => {
    form.reset();
    setUploadError(null);
    onClose();
  };

  const isLoading = form.formState.isSubmitting;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      if (!apiUrl) {
        throw new Error('API URL is required');
      }

      await secureAxiosPost(apiUrl, {
        ...values,
        content: values.fileUrl,
      });

      form.reset();
      router.refresh();
      handleClose();

      // Refresh track record messages
      queryClient.invalidateQueries({ queryKey: ['track-record-messages'] });
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className='bg-white text-black p-0 overflow-hidden'>
        <DialogHeader className='pt-8 px-6'>
          <DialogTitle className='text-2xl text-center font-bold'>
            Add Track Record File
          </DialogTitle>
          <DialogDescription className='text-center text-zinc-500'>
            Upload a file to share with the track record. This will be visible
            to everyone.
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
                              <FileIcon className='h-10 w-10 fill-purple-200 stroke-purple-400' />
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
                                ut-button:bg-purple-500 ut-button:text-white ut-button:hover:bg-purple-500/90 ut-button:ut-readying:bg-purple-500/90 ut-button:ut-uploading:bg-purple-500/90 ut-button:after:bg-purple-700
                                ut-label:text-zinc-700 ut-allowed-content:text-zinc-500'
                              endpoint='trackRecordFile'
                              onClientUploadComplete={res => {
                                if (res && res[0]) {
                                  field.onChange(res[0].url);
                                  setUploadError(null);
                                }
                              }}
                              onUploadError={(error: Error) => {
                                setUploadError(error.message);
                              }}
                              onUploadBegin={name => {
                                setUploadError(null);
                              }}
                            />
                            {uploadError && (
                              <div className='text-red-500 text-sm text-center p-2 bg-red-50 rounded'>
                                Upload Error: {uploadError}
                              </div>
                            )}
                            <div className='text-xs text-gray-500 text-center'>
                              💡 Supports images and PDFs. Admin access
                              required.
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
              <Button variant='default' disabled={isLoading}>
                Send
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
