'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, UseFormReturn, FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import { BaseModal } from './base-modal';
import { useStore } from '@/store/store';

interface FormModalProps {
  type: string;
  title: string;
  description?: string;
  schema: any;
  defaultValues: any;
  onSubmit: (data: any) => Promise<void>;
  onSuccess?: () => void;
  children: (form: UseFormReturn<any>) => React.ReactNode;
  submitText?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function FormModal({
  type,
  title,
  description,
  schema,
  defaultValues,
  onSubmit,
  onSuccess,
  children,
  submitText = 'Save',
  size = 'md',
  className,
}: FormModalProps) {
  const router = useRouter();
  const closeModal = useStore(state => state.onClose);
  const isOpen = useStore(state => state.isOpen);
  const modalType = useStore(state => state.type);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  // Reset form with new default values when modal opens
  React.useEffect(() => {
    if (isOpen && modalType === type) {
      form.reset(defaultValues);
    }
  }, [isOpen, modalType, type, defaultValues, form]);

  const isLoading = form.formState.isSubmitting;

  const handleSubmit = async (data: any) => {
    try {
      await onSubmit(data);
      form.reset();
      router.refresh();
      closeModal();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Form submission error:', error);
      toast.error('Something went wrong');
    }
  };

  const handleClose = () => {
    form.reset();
    closeModal();
  };

  return (
    <BaseModal
      type={type}
      title={title}
      description={description}
      size={size}
      loading={isLoading}
      onClose={handleClose}
      className={className}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-6'>
          {children(form)}

          <div className='flex items-center justify-between pt-6'>
            <Button
              type='button'
              variant='ghost'
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type='submit'
              disabled={isLoading}
              className='bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-bold'
            >
              {isLoading ? (
                <>
                  <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                  Saving...
                </>
              ) : (
                submitText
              )}
            </Button>
          </div>
        </form>
      </Form>
    </BaseModal>
  );
}
