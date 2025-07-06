'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { toast } from 'sonner';

export type DragItem = {
  id: string;
  type: 'channel' | 'section';
  data: any;
};

interface DragDropContextValue {
  isDragging: boolean;
  dragItem: DragItem | null;
  reorderChannel: (
    serverId: string,
    channelId: string,
    newPosition: number,
    newSectionId?: string
  ) => Promise<void>;
  reorderSection: (
    serverId: string,
    sectionId: string,
    newPosition: number,
    newParentId?: string
  ) => Promise<void>;
  onChannelReorder?: (
    channelId: string,
    newPosition: number,
    newSectionId?: string | null
  ) => void;
  onSectionReorder?: (
    sectionId: string,
    newPosition: number,
    newParentId?: string | null
  ) => void;
  setOptimisticCallbacks: (callbacks: {
    onChannelReorder?: (
      channelId: string,
      newPosition: number,
      newSectionId?: string | null
    ) => void;
    onSectionReorder?: (
      sectionId: string,
      newPosition: number,
      newParentId?: string | null
    ) => void;
  }) => void;
}

const DragDropContext = createContext<DragDropContextValue | undefined>(
  undefined
);

export const useDragDrop = () => {
  const context = useContext(DragDropContext);
  if (!context) {
    throw new Error('useDragDrop must be used within a DragDropProvider');
  }
  return context;
};

interface DragDropProviderProps {
  children: React.ReactNode;
}

export function DragDropProvider({ children }: DragDropProviderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  // Use refs to store optimistic update callbacks - prevents infinite re-renders
  const onChannelReorderRef = useRef<
    | ((
        channelId: string,
        newPosition: number,
        newSectionId?: string | null
      ) => void)
    | undefined
  >();
  const onSectionReorderRef = useRef<
    | ((
        sectionId: string,
        newPosition: number,
        newParentId?: string | null
      ) => void)
    | undefined
  >();

  // Debounced router refresh to avoid multiple refreshes during rapid operations
  const debouncedRefresh = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      router.refresh();
    }, 1000); // Wait 1 second after last operation before refreshing
  }, [router]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Slightly higher to prevent accidental drags
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const reorderChannel = useCallback(
    async (
      serverId: string,
      channelId: string,
      newPosition: number,
      newSectionId?: string
    ) => {
      try {
        await axios.patch('/api/channels/reorder', {
          serverId,
          channelId,
          newPosition,
          newSectionId,
        });

        // Debounced refresh to sync with server data
        debouncedRefresh();
      } catch (error: any) {
        console.error('Error reordering channel:', error);
        // Only show error if it's a client-side issue (like network failure)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          const errorMessage =
            error?.response?.data?.message || 'Failed to save channel order';
          toast.error(errorMessage);
        }
        // Don't throw error to prevent breaking the UI flow
      }
    },
    [debouncedRefresh]
  );

  const reorderSection = useCallback(
    async (
      serverId: string,
      sectionId: string,
      newPosition: number,
      newParentId?: string
    ) => {
      try {
        await axios.patch('/api/sections/reorder', {
          serverId,
          sectionId,
          newPosition,
          newParentId,
        });

        // No refresh for sections - optimistic updates handle the visual changes
        // The database is updated but we rely on optimistic updates for immediate feedback
      } catch (error: any) {
        console.error('Error reordering section:', error);
        // Only show error if it's a client-side issue (like network failure)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          const errorMessage =
            error?.response?.data?.message || 'Failed to save section order';
          toast.error(errorMessage);
        }
        // Don't throw error to prevent breaking the UI flow
      }
    },
    [] // Removed debouncedRefresh dependency
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;

    // Parse the drag item from the active id
    const activeId = active.id.toString();

    // Handle special case for default section
    if (activeId === 'default-section') {
      setDragItem({
        id: 'default',
        type: 'section',
        data: active.data.current,
      });
      setIsDragging(true);
      return;
    }

    const [type, id] = activeId.split('-');

    if (type === 'channel' || type === 'section') {
      setDragItem({
        id,
        type,
        data: active.data.current,
      });
      setIsDragging(true);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setIsDragging(false);
    setDragItem(null);

    if (!over) {
      return;
    }

    const activeId = active.id.toString();
    const overId = over.id.toString();

    if (activeId === overId) {
      return;
    }

    // Handle special case for default section
    if (activeId === 'default-section') {
      const overType = overId.startsWith('section-') ? 'section' : 'default';
      const overItemId = overId.startsWith('section-')
        ? overId.split('-')[1]
        : 'default';

      handleSectionDrop(
        'default',
        overType,
        overItemId,
        active.data.current,
        over.data.current
      );
      return;
    }

    // Parse IDs for regular items
    const [activeType, activeItemId] = activeId.split('-');
    const [overType, overItemId] = overId.split('-');

    // Handle the drop based on item types
    if (activeType === 'channel') {
      handleChannelDrop(
        activeItemId,
        overType,
        overItemId,
        active.data.current,
        over.data.current
      );
    } else if (activeType === 'section') {
      handleSectionDrop(
        activeItemId,
        overType,
        overItemId,
        active.data.current,
        over.data.current
      );
    }
  };

  const handleChannelDrop = (
    channelId: string,
    overType: string,
    overItemId: string,
    activeData: any,
    overData: any
  ) => {
    if (!activeData?.serverId) {
      return;
    }

    // Immediately update the UI with optimistic updates
    if (overType === 'channel') {
      const newPosition = overData?.position || 0;
      const sectionId = overData?.sectionId || activeData?.sectionId;

      if (onChannelReorderRef.current) {
        onChannelReorderRef.current(channelId, newPosition, sectionId);
      }
    } else if (overType === 'section') {
      const newPosition = 0;

      if (onChannelReorderRef.current) {
        onChannelReorderRef.current(channelId, newPosition, overItemId);
      }
    }

    // API call in background
    performChannelUpdate(channelId, overType, overItemId, activeData, overData);
  };

  const handleSectionDrop = (
    sectionId: string,
    overType: string,
    overItemId: string,
    activeData: any,
    overData: any
  ) => {
    if (!activeData?.serverId) {
      return;
    }

    // Handle default section reordering
    const isDefaultSection =
      activeData?.isDefaultSection || sectionId === 'default';

    // Handle the optimistic update for visual feedback
    if (overType === 'section' || overItemId || overData?.isDefaultSection) {
      // SIMPLIFIED: Just use the target's visual index as the new position
      // The position rebuilding logic in section-content.tsx will handle making
      // sure all positions are sequential and conflict-free

      let newPosition = 0;

      if (overData?.sortable?.index !== undefined) {
        // Use the target's visual index directly - much simpler!
        newPosition = overData.sortable.index;
      }

      const newParentId = overData?.parentId || null;

      if (onSectionReorderRef.current) {
        onSectionReorderRef.current(sectionId, newPosition, newParentId);
      }

      // Only make API call for real sections, not the default section
      if (!isDefaultSection) {
        performSectionUpdate(
          sectionId,
          overType,
          overItemId,
          activeData,
          overData
        );
      }
    }
  };

  const performChannelUpdate = async (
    channelId: string,
    overType: string,
    overItemId: string,
    activeData: any,
    overData: any
  ) => {
    try {
      if (overType === 'channel') {
        const newPosition = overData?.position || 0;
        const sectionId = overData?.sectionId || activeData?.sectionId;

        await reorderChannel(
          activeData.serverId,
          channelId,
          newPosition,
          sectionId
        );
      } else if (overType === 'section') {
        const newPosition = 0;
        await reorderChannel(
          activeData.serverId,
          channelId,
          newPosition,
          overItemId
        );
      }
    } catch (error) {
      console.error('Error updating channel:', error);
    }
  };

  const performSectionUpdate = async (
    sectionId: string,
    overType: string,
    overItemId: string,
    activeData: any,
    overData: any
  ) => {
    try {
      if (overType === 'section') {
        const newPosition = overData?.position || 0;
        const newParentId = overData?.parentId || null;

        await reorderSection(
          activeData.serverId,
          sectionId,
          newPosition,
          newParentId
        );
      }
    } catch (error) {
      console.error('Error updating section:', error);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Handle drag over events if needed for visual feedback
  };

  const setOptimisticCallbacks = useCallback(
    (callbacks: {
      onChannelReorder?: (
        channelId: string,
        newPosition: number,
        newSectionId?: string | null
      ) => void;
      onSectionReorder?: (
        sectionId: string,
        newPosition: number,
        newParentId?: string | null
      ) => void;
    }) => {
      onChannelReorderRef.current = callbacks.onChannelReorder;
      onSectionReorderRef.current = callbacks.onSectionReorder;
    },
    []
  );

  const value: DragDropContextValue = useMemo(
    () => ({
      isDragging,
      dragItem,
      reorderChannel,
      reorderSection,
      onChannelReorder: onChannelReorderRef.current,
      onSectionReorder: onSectionReorderRef.current,
      setOptimisticCallbacks,
    }),
    [
      isDragging,
      dragItem,
      reorderChannel,
      reorderSection,
      setOptimisticCallbacks,
    ]
  );

  return (
    <DragDropContext.Provider value={value}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        modifiers={[restrictToVerticalAxis]}
      >
        {children}
        <DragOverlay>
          {dragItem && (
            <div className='bg-gray-700 p-2 shadow-lg border border-gray-300'>
              <span className='text-white text-sm'>
                {dragItem.type === 'channel' ? '📝' : '📁'}{' '}
                {dragItem.data?.name || 'Moving item...'}
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </DragDropContext.Provider>
  );
}

export { DragDropContext };
