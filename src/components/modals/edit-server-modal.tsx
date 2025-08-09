'use client';

import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { UploadDropzone } from '@/lib/uploadthing';
import { useStore } from '@/store/store';
import NextImage from 'next/image';
import { z } from 'zod';
import { FormModal } from './base';

export function EditServerModal() {
  const data = useStore(state => state.data);

  const schema = z.object({
    name: z.string().min(1, { message: 'Server name is required' }),
    imageUrl: z.string().min(1, { message: 'Server image is required' }),
  });

  const onSubmit = async (values: z.infer<typeof schema>) => {
    if (!data?.server?.id) {
      throw new Error('No server ID found');
    }
    await fetch(`/api/servers/${data.server.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(values),
    });
  };

  // Get initial values from server data
  const getDefaultValues = () => {
    return {
      name: data?.server?.name || '',
      imageUrl: data?.server?.imageUrl || '',
    };
  };
  return (
    <FormModal
      type='editServer'
      title='Customize your server'
      description='Give your server a personality with a name and an image. You can always change these later.'
      schema={schema}
      defaultValues={getDefaultValues()}
      onSubmit={onSubmit}
      submitText='Save'
    >
      {form => (
        <>
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
                        }}
                        onUploadError={(error: Error) => {
                          console.error('Upload error:', error.message);
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
                    className='bg-zinc-300/50 border-0 focus-visible:ring-0 text-black focus-visible:ring-offset-0'
                    placeholder='Enter server name'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    </FormModal>
  );
}
