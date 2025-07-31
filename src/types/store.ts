import { Server, Channel, Member, Message, Section } from '@prisma/client';
import { StateCreator } from 'zustand';

export type ModalType =
  | 'createServer'
  | 'editServer'
  | 'createChannel'
  | 'editChannel'
  | 'deleteChannel'
  | 'messageFile'
  | 'deleteMessage'
  | 'createSection'
  | 'editSection'
  | 'deleteSection'
  | 'timerSettings'
  | 'emailWarning';

type ModalData = {
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
  stripeUrl?: string;
};

interface ModalState {
  type: ModalType | null;
  isOpen: boolean;
  data: ModalData;
}

interface ModalActions {
  onOpen: (type: ModalType, data?: ModalData) => void;
  onClose: () => void;
}

export interface ModalSlice extends ModalState, ModalActions {}

// ✅ SIMPLIFIED: Removed complex middleware types that were causing build errors
type SliceCreator<S> = StateCreator<S, [], [], S>;
