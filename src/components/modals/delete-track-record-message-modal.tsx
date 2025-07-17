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
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';

export function DeleteTrackRecordMessageModal() {
  const router = useRouter();
  const type = useStore(state => state.type);
  const isOpen = useStore(state => state.isOpen);
  const onClose = useStore(state => state.onClose);
  const data = useStore(state => state.data);
  const isModelOpen = isOpen && type === 'deleteTrackRecordMessage';
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    try {
      setIsLoading(true);

      await secureAxiosDelete(
        `/api/track-record/messages/${data?.message?.id}`
      );

      onClose();

      // Refresh the page to update the messages
      router.refresh();

      // Also trigger a custom event to refresh the track record component
      window.dispatchEvent(new CustomEvent('trackRecordRefresh'));
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
          <DialogTitle className='text-xl sm:text-2xl text-center font-bold flex items-center justify-center gap-2'>
            <Trash2 className='h-5 w-5 text-red-400' />
            Delete Track Record Message
          </DialogTitle>
          <DialogDescription className='text-center text-zinc-400 text-sm sm:text-base space-y-3'>
            <p>Are you sure you want to delete this track record message?</p>
            <div className='bg-gradient-to-r from-red-500/10 to-red-600/10 rounded-xl p-3 border border-red-400/20'>
              <div className='flex items-center gap-2 mb-2'>
                <AlertTriangle className='h-4 w-4 text-red-400' />
                <span className='text-red-400 font-medium text-sm'>
                  Warning
                </span>
              </div>
              <p className='text-xs text-gray-300'>
                This action cannot be undone. The message will be permanently
                deleted from the track record.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className='px-4 sm:px-6 py-2'>
          <div className='bg-gray-800/50 rounded-lg p-3 border border-gray-700/30'>
            <p className='text-sm text-gray-300 italic'>
              "{data?.message?.content?.substring(0, 100)}
              {(data?.message?.content?.length || 0) > 100 ? '...' : ''}"
            </p>
          </div>
        </div>

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
              onClick={handleDelete}
              variant='destructive'
              className='w-full sm:w-auto min-h-[44px] touch-manipulation bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600'
            >
              {isLoading ? (
                <>
                  <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className='h-4 w-4 mr-2' />
                  Delete Message
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
