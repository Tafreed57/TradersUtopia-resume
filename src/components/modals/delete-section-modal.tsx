'use client';

import { ConfirmationModal } from './base';
import { useStore } from '@/store/store';
import { secureAxiosDelete } from '@/lib/csrf-client';
import { useRouter } from 'next/navigation';
import qs from 'query-string';

export function DeleteSectionModal() {
  const router = useRouter();
  const data = useStore(state => state.data);

  const handleDeleteSection = async () => {
    const url = `/api/servers/${data?.server?.id}/sections/${data?.section?.id}`;
    await secureAxiosDelete(url);
    router.refresh();
  };

  const description = `Are you sure you want to delete "${data?.section?.name}" section? All channels in this section will be moved to the default section.`;

  return (
    <ConfirmationModal
      type='deleteSection'
      title='Delete Section'
      description={description}
      onConfirm={handleDeleteSection}
      confirmText='Delete Section'
      variant='destructive'
    />
  );
}
