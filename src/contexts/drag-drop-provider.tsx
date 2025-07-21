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
import { secureAxiosPatch } from '@/lib/csrf-client';
import { toast } from 'sonner';

type DragItem = {
  id: string;
  type: 'channel' | 'section';
  data: any;
};

type InsertionIndicator = {
  type: 'channel' | 'section';
  containerId: string;
  index: number;
  position: 'before' | 'after';
} | null;

interface DragDropContextValue {
  isDragging: boolean;
  dragItem: DragItem | null;
  insertionIndicator: InsertionIndicator;
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
  const [insertionIndicator, setInsertionIndicator] =
    useState<InsertionIndicator>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

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
        await secureAxiosPatch('/api/channels/reorder', {
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
        await secureAxiosPatch('/api/sections/reorder', {
          serverId,
          sectionId,
          newPosition,
          newParentId,
        });

        // Use debounced refresh like channels do for consistency
        debouncedRefresh();
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
    [debouncedRefresh]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;

    // Clear any existing insertion indicator
    setInsertionIndicator(null);

    // Parse the drag item from the active id
    const activeId = active.id.toString();

    // Handle special case for default section
    if (activeId === 'default-section') {
      setDragItem({
        id: 'default-section',
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
    setInsertionIndicator(null);

    if (!over) {
      return;
    }

    const activeId = active.id.toString();
    const overId = over.id.toString();

    if (activeId === overId) {
      return;
    }

    // Parse IDs for all items uniformly
    const [activeType, activeItemId] = activeId.includes('-')
      ? activeId.split('-')
      : ['section', activeId]; // Handle default-section as a section
    const [overType, overItemId] = overId.includes('-')
      ? overId.split('-')
      : ['section', overId];

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
        activeId, // Use full ID for sections including default-section
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

      performChannelUpdate(
        channelId,
        overType,
        overItemId,
        activeData,
        overData
      );
    } else if (overType === 'section') {
      const newPosition = 0;

      performChannelUpdate(
        channelId,
        overType,
        overItemId,
        activeData,
        overData
      );
    }
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

    // Handle section drops the same way as channels - direct API calls
    if (overType === 'section') {
      // Section dropped on another section - reorder within same level
      const newPosition = overData?.position || 0;
      const newParentId = overData?.parentId || null;

      // Make API call directly like channels do
      performSectionUpdate(
        sectionId,
        overType,
        overItemId,
        activeData,
        overData,
        newPosition
      );
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
    overData: any,
    newPosition: number
  ) => {
    try {
      if (overType === 'section') {
        const newParentId = overData?.parentId || null;

        // Extract the actual section ID from the full ID (remove "section-" prefix)
        const actualSectionId = sectionId.startsWith('section-')
          ? sectionId.replace('section-', '')
          : sectionId;

        await reorderSection(
          activeData.serverId,
          actualSectionId,
          newPosition,
          newParentId
        );
      }
    } catch (error) {
      console.error('Error updating section:', error);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;

    if (!over || !active) {
      setInsertionIndicator(null);
      return;
    }

    const activeId = active.id.toString();
    const overId = over.id.toString();

    // Don't show insertion indicator when hovering over the dragged item itself
    if (activeId === overId) {
      setInsertionIndicator(null);
      return;
    }

    // Parse the over item
    const [overType, overItemId] = overId.includes('-')
      ? overId.split('-')
      : ['section', overId];

    // Get the bounding rect of the over item to determine insertion position
    const overRect = over.rect;
    const overData = over.data.current;

    if (!overRect) {
      setInsertionIndicator(null);
      return;
    }

    // Calculate if we're in the top half (before) or bottom half (after) of the item
    const pointerY = event.delta.y + (event.activatorEvent as any)?.clientY;
    const overMiddleY = overRect.top + overRect.height / 2;
    const position = pointerY < overMiddleY ? 'before' : 'after';

    // Set the insertion indicator
    if (overType === 'channel') {
      setInsertionIndicator({
        type: 'channel',
        containerId: overData?.sectionId || 'default',
        index: overData?.position || 0,
        position,
      });
    } else if (overType === 'section') {
      setInsertionIndicator({
        type: 'section',
        containerId: 'root',
        index: overData?.position || 0,
        position,
      });
    }
  };

  const value: DragDropContextValue = useMemo(
    () => ({
      isDragging,
      dragItem,
      insertionIndicator,
      reorderChannel,
      reorderSection,
    }),
    [isDragging, dragItem, insertionIndicator, reorderChannel, reorderSection]
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
