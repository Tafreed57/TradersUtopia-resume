'use client';

import { ConfirmationModal } from './base';
import { useStore } from '@/store/store';
import { secureAxiosDelete } from '@/lib/csrf-client';
import { useRouter } from 'next/navigation';
import qs from 'query-string';

export function DeleteMessageModal() {
  const router = useRouter();
  const data = useStore(state => state.data);

  const handleDeleteMessage = async () => {
    const url = qs.stringifyUrl({
      url: data?.apiUrl || '',
      query: data?.query,
    });
    await secureAxiosDelete(url);
    router.refresh();
  };

  return (
    <ConfirmationModal
      type='deleteMessage'
      title='Delete Message'
      description='The message will be permanently deleted!'
      onConfirm={handleDeleteMessage}
      confirmText='Delete Message'
      variant='destructive'
    />
  );
}
