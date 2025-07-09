'use client';

import { CreateServerModal } from '@/components/modals/create-server-modal';
import { InviteModal } from '@/components/modals/invite-modal';
import { EditServerModal } from '@/components/modals/edit-server-modal';
import { ManageMembersModal } from '@/components/modals/manage-members-modal';
import { CreateChannelModal } from '@/components/modals/create-channel-modal';
import { EditChannelModal } from '@/components/modals/edit-channel-modal';
import { DeleteChannelModal } from '@/components/modals/delete-channel-modal';
import { MessageFileModal } from '@/components/modals/message-file-modal';
import { DeleteMessageModal } from '@/components/modals/delete-message-modal';
import { CreateSectionModal } from '@/components/modals/create-section-modal';
import { EditSectionModal } from '@/components/modals/edit-section-modal';
import { EditDefaultSectionModal } from '@/components/modals/edit-default-section-modal';
import { DeleteSectionModal } from '@/components/modals/delete-section-modal';
import { TrackRecordFileModal } from '@/components/modals/track-record-file-modal';
import { EditTrackRecordMessageModal } from '@/components/modals/edit-track-record-message-modal';
import { DeleteTrackRecordMessageModal } from '@/components/modals/delete-track-record-message-modal';
import { useEffect, useState } from 'react';

export function ModalProvider() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <>
      <CreateServerModal />
      <EditServerModal />
      <InviteModal />
      <ManageMembersModal />
      <CreateChannelModal />
      <EditChannelModal />
      <DeleteChannelModal />
      <MessageFileModal />
      <DeleteMessageModal />
      <CreateSectionModal />
      <EditSectionModal />
      <EditDefaultSectionModal />
      <DeleteSectionModal />
      <TrackRecordFileModal />
      <EditTrackRecordMessageModal />
      <DeleteTrackRecordMessageModal />
    </>
  );
}
