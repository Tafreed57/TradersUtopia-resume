import { ModalSlice } from '@/types/store';
import { create } from 'zustand';

// ✅ ULTRA-SIMPLIFIED STORE: Removed all middleware to prevent infinite loops
// This is a minimal implementation to isolate the infinite loop issue

interface SimpleStore extends ModalSlice {}

export const useStore = create<SimpleStore>(set => ({
  type: null,
  isOpen: false,
  data: {},
  onOpen: (type, data) => set({ isOpen: true, type, data: data || {} }),
  onClose: () => set({ type: null, isOpen: false, data: {} }),
}));
