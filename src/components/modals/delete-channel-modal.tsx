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
import { useStore } from '@/store/store';
import { secureAxiosDelete } from '@/lib/csrf-client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import qs from 'query-string';

export function DeleteChannelModal() {
  const router = useRouter();
  const type = useStore(state => state.type);
  const isOpen = useStore(state => state.isOpen);
  const onClose = useStore(state => state.onClose);
  const data = useStore(state => state.data);
  const isModelOpen = isOpen && type === 'deleteChannel';
  const [isLoading, setIsLoading] = useState(false);

  const handleDeleteServer = async () => {
    try {
      setIsLoading(true);
      const url = qs.stringifyUrl({
        url: `/api/channels/${data?.channel?.id}`,
        query: { serverId: data?.server?.id },
      });
      await secureAxiosDelete(url);
      onClose();
      router.refresh();
      router.push(`/servers/${data?.server?.id}`);
    } catch (error: any) {
      //
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isModelOpen} onOpenChange={onClose}>
      <DialogContent
        aria-describedby={undefined}
        className='bg-white text-black p-0 overflow-hidden'
      >
        <DialogHeader className='pt-8 px-6'>
          <DialogTitle className='text-2xl text-center font-bold'>
            Delete Channel
          </DialogTitle>
          <DialogDescription className='text-center text-zinc-500'>
            Are you sure you want to Delete{' '}
            <span className='text-indigo-500 font-semibold'>
              #{data?.channel?.name}
            </span>{' '}
            Channel ?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className='px-6 py-4 bg-gray-100'>
          <div className='flex items-center justify-between w-full'>
            <Button disabled={isLoading} onClick={onClose} variant='ghost'>
              Cancel
            </Button>
            <Button
              disabled={isLoading}
              onClick={handleDeleteServer}
              variant='default'
            >
              Confirm
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
