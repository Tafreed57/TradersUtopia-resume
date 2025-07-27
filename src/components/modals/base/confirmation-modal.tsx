'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { BaseModal } from './base-modal';
import { useStore } from '@/store/store';

interface ConfirmationModalProps {
  type: string;
  title: string;
  description: string;
  onConfirm: () => Promise<void> | void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

export function ConfirmationModal({
  type,
  title,
  description,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
}: ConfirmationModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const closeModal = useStore(state => state.onClose);
  const router = useRouter();

  const handleConfirm = async () => {
    try {
      setIsLoading(true);
      await onConfirm();
      router.refresh();
      closeModal();
    } catch (error) {
      console.error('Confirmation error:', error);
      toast.error('Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmButtonClass =
    variant === 'destructive'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-bold';

  return (
    <BaseModal
      type={type}
      title={title}
      description={description}
      size='sm'
      loading={isLoading}
    >
      <div className='flex items-center justify-between pt-6'>
        <Button
          type='button'
          variant='ghost'
          onClick={closeModal}
          disabled={isLoading}
        >
          {cancelText}
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isLoading}
          className={confirmButtonClass}
        >
          {isLoading ? (
            <>
              <Loader2 className='w-4 h-4 mr-2 animate-spin' />
              Processing...
            </>
          ) : (
            confirmText
          )}
        </Button>
      </div>
    </BaseModal>
  );
}
