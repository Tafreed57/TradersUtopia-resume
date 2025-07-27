'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BaseModalProps<T = any> {
  type: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  onSubmit?: (data: T) => Promise<void> | void;
  onClose?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
}

export function BaseModal<T>({
  type,
  title,
  description,
  children,
  onSubmit,
  onClose,
  className,
  size = 'md',
  loading = false,
}: BaseModalProps<T>) {
  const router = useRouter();
  const modalType = useStore(state => state.type);
  const isOpen = useStore(state => state.isOpen);
  const closeModal = useStore(state => state.onClose);

  const isModalOpen = isOpen && modalType === type;

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
    closeModal();
  };

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          'bg-white text-black p-0 overflow-hidden',
          sizeClasses[size],
          className
        )}
      >
        <DialogHeader className='pt-8 px-6'>
          <DialogTitle className='text-2xl text-center font-bold'>
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className='text-center text-zinc-500'>
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className='px-6 pb-6'>{children}</div>

        {loading && (
          <div className='absolute inset-0 bg-black/50 flex items-center justify-center'>
            <Loader2 className='w-6 h-6 animate-spin text-white' />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
