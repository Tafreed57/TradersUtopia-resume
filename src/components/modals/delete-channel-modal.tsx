'use client';

import { ConfirmationModal } from './base';
import { useStore } from '@/store/store';
import { secureAxiosDelete } from '@/lib/csrf-client';
import { useRouter } from 'next/navigation';

export function DeleteChannelModal() {
  const router = useRouter();
  const data = useStore(state => state.data);

  const handleDeleteChannel = async () => {
    // Use new server-based endpoint structure
    const url = `/api/servers/${data?.server?.id}/channels/${data?.channel?.id}`;

    // Perform the deletion
    await secureAxiosDelete(url);

    // Emit custom event for real-time UI update
    const deleteEvent = new CustomEvent('channel-deleted', {
      detail: {
        channelId: data?.channel?.id,
        serverId: data?.server?.id,
        sectionId: data?.channel?.sectionId || null,
      },
    });
    window.dispatchEvent(deleteEvent);

    // Navigate to server root instead of refreshing
    router.push(`/servers/${data?.server?.id}`);
  };

  return (
    <ConfirmationModal
      type='deleteChannel'
      title='Delete Channel'
      description={`Are you sure you want to delete #${data?.channel?.name}? This action cannot be undone.`}
      onConfirm={handleDeleteChannel}
      confirmText='Delete Channel'
      variant='destructive'
    />
  );
}
