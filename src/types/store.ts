import { Server, Channel, Member, Message, Section } from '@prisma/client';
import { StateCreator } from 'zustand';

export type ModalType =
  | 'createServer'
  | 'invite'
  | 'editServer'
  | 'manageMembers'
  | 'createChannel'
  | 'editChannel'
  | 'deleteChannel'
  | 'messageFile'
  | 'deleteMessage'
  | 'createSection'
  | 'editSection'
  | 'editDefaultSection'
  | 'deleteSection'
  | 'trackRecordFile'
  | 'editTrackRecordMessage'
  | 'deleteTrackRecordMessage';

export type ModalData = {
  server?: Server;
  channel?: Channel;
  member?: Member;
  message?: Message;
  apiUrl?: string;
  query?: Record<string, any>;
  section?: Section;
  channelType?: any; // ✅ Added back to fix TypeScript error
  onAction?: () => void;
  onComplete?: () => void;
  fileUrl?: string;
  messageId?: string;
  sectionId?: string;
  channelId?: string;
  serverId?: string;
  userId?: string;
};

export interface ModalState {
  type: ModalType | null;
  isOpen: boolean;
  data: ModalData;
}

export interface ModalActions {
  onOpen: (type: ModalType, data?: ModalData) => void;
  onClose: () => void;
}

export interface ModalSlice extends ModalState, ModalActions {}

// ✅ SIMPLIFIED: Removed complex middleware types that were causing build errors
export type SliceCreator<S> = StateCreator<S, [], [], S>;
