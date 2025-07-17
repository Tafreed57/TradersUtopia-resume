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
  const type = useStore(state => state.type);
  const isOpen = useStore(state => state.isOpen);
  const onClose = useStore(state => state.onClose);
  const data = useStore(state => state.data);
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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isModelOpen} onOpenChange={onClose}>
      <DialogContent
        aria-describedby={undefined}
        className='bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl border border-gray-700/50 text-white p-0 overflow-hidden w-[90vw] max-w-md mx-auto'
      >
        <DialogHeader className='pt-6 sm:pt-8 px-4 sm:px-6'>
          <DialogTitle className='text-xl sm:text-2xl text-center font-bold'>
            Delete Message
          </DialogTitle>
          <DialogDescription className='text-center text-zinc-500 text-sm sm:text-base'>
            The Message will be permanently deleted!
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className='px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-800/80 via-gray-700/80 to-gray-800/80 backdrop-blur-sm border-t border-gray-700/50'>
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
