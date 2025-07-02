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

export function DeleteMessageModal() {
  const router = useRouter();
  const type = useStore.use.type();
  const isOpen = useStore.use.isOpen();
  const onClose = useStore.use.onClose();
  const data = useStore.use.data();
  const isModelOpen = isOpen && type === 'deleteMessage';
  const [isLoading, setIsLoading] = useState(false);

  const handleDeleteServer = async () => {
    try {
      setIsLoading(true);
      const url = qs.stringifyUrl({
        url: data?.apiUrl || '',
        query: data?.query,
      });
      await secureAxiosDelete(url);
      onClose();
      router.refresh();
    } catch (error: any) {
      console.log(error, 'DELETE MESSAGE ERROR');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isModelOpen} onOpenChange={onClose}>
      <DialogContent
        aria-describedby={undefined}
        className='bg-gray-900 text-white p-0 overflow-hidden w-[90vw] max-w-md mx-auto'
      >
        <DialogHeader className='pt-6 sm:pt-8 px-4 sm:px-6'>
          <DialogTitle className='text-xl sm:text-2xl text-center font-bold'>
            Delete Message
          </DialogTitle>
          <DialogDescription className='text-center text-zinc-500 text-sm sm:text-base'>
            The Message will be permanently deleted!
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className='px-4 sm:px-6 py-4 bg-gray-800'>
          <div className='flex flex-col sm:flex-row items-center gap-3 sm:justify-between w-full'>
            <Button
              disabled={isLoading}
              onClick={onClose}
              variant='ghost'
              className='w-full sm:w-auto min-h-[44px] touch-manipulation'
            >
              Cancel
            </Button>
            <Button
              disabled={isLoading}
              onClick={handleDeleteServer}
              variant='destructive'
              className='w-full sm:w-auto min-h-[44px] touch-manipulation'
            >
              Delete Message
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
