import { Channel, ChannelType, Section, Server } from '@prisma/client';
import { ServerWithMembersWithProfiles } from '@/types/server';
import { StateCreator } from 'zustand';

export type ModalType =
  | 'createServer'
  | 'invite'
  | 'editServer'
  | 'manageMembers'
  | 'leaveServer'
  | 'deleteServer'
  | 'createChannel'
  | 'editChannel'
  | 'deleteChannel'
  | 'createSection'
  | 'editSection'
  | 'editDefaultSection'
  | 'messageFile'
  | 'deleteMessage';

export interface ModalData {
  server?: Server | ServerWithMembersWithProfiles;
  channel?: Channel;
  section?: Section & { channels?: Channel[] };
  channelType?: ChannelType;
  apiUrl?: string;
  query?: Record<string, any>;
}

export interface ModalState {
  type: ModalType | null;
  data: ModalData;
  isOpen: boolean;
}

export interface ModalActions {
  onOpen: (type: ModalType, data?: ModalData) => void;
  onClose: () => void;
}

export type ModalSlice = ModalState & ModalActions;

export type SliceCreator<S> = StateCreator<
  S,
  [['zustand/immer', never], ['zustand/devtools', never]],
  [],
  S
>;
export type Store = ModalSlice;
