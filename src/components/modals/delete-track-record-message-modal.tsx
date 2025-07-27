'use client';

import { ConfirmationModal } from './base';
import { useStore } from '@/store/store';
import { secureAxiosDelete } from '@/lib/csrf-client';
import { useRouter } from 'next/navigation';

export function DeleteTrackRecordMessageModal() {
  const router = useRouter();
  const data = useStore(state => state.data);

  const handleDelete = async () => {
    await secureAxiosDelete(`/api/track-record/messages/${data?.message?.id}`);

    // Refresh the page to update the messages
    router.refresh();

    // Also trigger a custom event to refresh the track record component
    window.dispatchEvent(new CustomEvent('trackRecordRefresh'));
  };

  const messagePreview = data?.message?.content?.substring(0, 100);
  const isLongMessage = (data?.message?.content?.length || 0) > 100;

  const description = `Are you sure you want to delete this track record message? This action cannot be undone.

Message preview: "${messagePreview}${isLongMessage ? '...' : ''}"`;

  return (
    <ConfirmationModal
      type='deleteTrackRecordMessage'
      title='Delete Track Record Message'
      description={description}
      onConfirm={handleDelete}
      confirmText='Delete Message'
      variant='destructive'
    />
  );
}
