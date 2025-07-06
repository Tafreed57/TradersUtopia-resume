'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChannelType, MemberRole } from '@prisma/client';
import { ServerSectionHeader } from '@/components/server-section-header';
import { ServerChannel } from '@/components/server-channel';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDragDrop } from '@/contexts/drag-drop-provider';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { DragStartEvent, DragOverEvent, DragEndEvent } from '@dnd-kit/core';

interface SectionContentProps {
  server: any;
  role: MemberRole | undefined;
  channelsWithoutSection: any[];
  sectionsWithChannels: any[];
}

// Recursive section component to handle nested sections
function SectionItem({
  section,
  server,
  role,
  collapsedSections,
  toggleSection,
  depth = 0,
}: {
  section: any;
  server: any;
  role: MemberRole | undefined;
  collapsedSections: Set<string>;
  toggleSection: (sectionId: string) => void;
  depth?: number;
}) {
  const isCollapsed = collapsedSections.has(section.id);
  const marginLeft = `${depth * 1.5}rem`;

  // Create sortable IDs for this section's channels
  const channelIds = section.channels.map(
    (channel: any) => `channel-${channel.id}`
  );
  const sectionIds = (section.children || []).map(
    (child: any) => `section-${child.id}`
  );

  const handleToggle = () => toggleSection(section.id);

  return (
    <div className='relative overflow-visible' style={{ marginLeft }}>
      <div className='overflow-visible'>
        <ServerSectionHeader
          sectionType='section'
          role={role}
          label={section.name}
          server={server}
          section={section}
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggle}
        />
      </div>
      {!isCollapsed && (
        <div className='flex flex-col space-y-1 ml-4 overflow-visible relative z-10'>
          {/* Render child sections first */}
          {section.children && section.children.length > 0 && (
            <SortableContext
              items={sectionIds}
              strategy={verticalListSortingStrategy}
            >
              {section.children.map((childSection: any) => (
                <SectionItem
                  key={childSection.id}
                  section={childSection}
                  server={server}
                  role={role}
                  collapsedSections={collapsedSections}
                  toggleSection={toggleSection}
                  depth={depth + 1}
                />
              ))}
            </SortableContext>
          )}

          {/* Render channels in this section */}
          {section.channels && section.channels.length > 0 && (
            <SortableContext
              items={channelIds}
              strategy={verticalListSortingStrategy}
            >
              {section.channels.map((channel: any) => (
                <div key={channel.id} className='overflow-visible'>
                  <ServerChannel
                    channel={channel}
                    server={server}
                    role={role}
                  />
                </div>
              ))}
            </SortableContext>
          )}

          {section.channels.length === 0 &&
            (!section.children || section.children.length === 0) && (
              <p className='text-xs text-gray-500 italic px-3 py-2'>
                No channels in this section
              </p>
            )}
        </div>
      )}
    </div>
  );
}

export function SectionContent({
  server,
  role,
  channelsWithoutSection,
  sectionsWithChannels,
}: SectionContentProps) {
  const { setOptimisticCallbacks } = useDragDrop();

  const [localChannelsWithoutSection, setLocalChannelsWithoutSection] =
    useState(channelsWithoutSection);
  const [localSectionsWithChannels, setLocalSectionsWithChannels] =
    useState(sectionsWithChannels);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set()
  );
  const [isTextChannelsCollapsed, setIsTextChannelsCollapsed] = useState(false);
  const [defaultSectionPosition, setDefaultSectionPosition] = useState(0);

  useEffect(() => {
    setLocalChannelsWithoutSection(channelsWithoutSection);
    setLocalSectionsWithChannels(sectionsWithChannels);
  }, [channelsWithoutSection, sectionsWithChannels]);

  useEffect(() => {
    if (typeof window !== 'undefined' && server) {
      try {
        const savedState = localStorage.getItem(
          `collapsed-sections-${server.id}`
        );
        if (savedState) {
          const collapsed = new Set(JSON.parse(savedState) as string[]);
          setCollapsedSections(collapsed);
        }
      } catch (error) {
        // Fallback for parsing errors
      }
    }
  }, [server]);

  useEffect(() => {
    if (typeof window !== 'undefined' && server) {
      try {
        const isCollapsed = localStorage.getItem(
          `text-channels-collapsed-${server.id}`
        );
        if (isCollapsed) {
          setIsTextChannelsCollapsed(JSON.parse(isCollapsed));
        }
      } catch (error) {
        // Fallback for parsing errors
      }
    }
  }, [server]);

  useEffect(() => {
    if (typeof window !== 'undefined' && server) {
      try {
        const position = localStorage.getItem(
          `default-section-pos-${server.id}`
        );
        if (position) {
          setDefaultSectionPosition(JSON.parse(position));
        }
      } catch (error) {
        // Fallback for parsing errors
      }
    }
  }, [server]);

  const saveCollapsedState = useCallback(
    (newState: Set<string>) => {
      // ... existing code ...
    },
    [server]
  );

  const saveTextChannelsCollapsedState = useCallback(
    (isCollapsed: boolean) => {
      // ... existing code ...
    },
    [server]
  );

  const saveDefaultSectionPosition = useCallback(
    (position: number) => {
      // ... existing code ...
    },
    [server]
  );

  const toggleSection = useCallback(
    (sectionId: string) => {
      // ... existing code ...
    },
    [collapsedSections, saveCollapsedState]
  );

  const toggleTextChannels = useCallback(() => {
    // ... existing code ...
  }, [isTextChannelsCollapsed, saveTextChannelsCollapsedState]);

  // DND Handlers
  const handleDragStart = (event: DragStartEvent) => {
    // ... existing code ...
  };

  const handleDragOver = (event: DragOverEvent) => {
    // ... existing code ...
  };

  const handleDragEnd = (event: DragEndEvent) => {
    // ... existing code ...
  };

  // Memoized components for rendering
  const textChannelsComponent = useMemo(
    () => ({
      id: 'text-channels',
      position: defaultSectionPosition,
      component: <div key='text-channels'>{/* Text channels content */}</div>,
    }),
    [defaultSectionPosition]
  );

  const sectionComponents = useMemo(
    () =>
      localSectionsWithChannels.map((section: any) => ({
        id: section.id,
        position: section.position || 0,
        component: (
          <SectionItem
            key={section.id}
            section={section}
            server={server}
            role={role}
            collapsedSections={collapsedSections}
            toggleSection={toggleSection}
          />
        ),
      })),
    [localSectionsWithChannels, server, role, collapsedSections, toggleSection]
  );

  const allSections = useMemo(
    () =>
      [...sectionComponents, textChannelsComponent].sort(
        (a, b) => a.position - b.position
      ),
    [sectionComponents, textChannelsComponent]
  );

  const allSortableIds = useMemo(
    () => allSections.map(section => section.id),
    [allSections]
  );

  return (
    <div className='space-y-3 overflow-visible'>
      {/* Combined sortable context for all sections including default */}
      <SortableContext
        items={allSortableIds}
        strategy={verticalListSortingStrategy}
      >
        {/* Render all sections in the correct sorted order */}
        {allSections.map((sectionItem, index) => (
          <div key={sectionItem.id || `section-${index}`}>
            {sectionItem.component}
          </div>
        ))}
      </SortableContext>

      {/* Show create section prompt if no sections exist and no ungrouped channels */}
      {localSectionsWithChannels.length === 0 &&
        localChannelsWithoutSection.length === 0 &&
        role !== MemberRole.GUEST && (
          <div className='px-3 py-4 text-center'>
            <p className='text-xs text-gray-500 mb-2'>
              No channels or sections created yet. Create your first section to
              organize channels!
            </p>
          </div>
        )}

      {/* Show create section prompt if only ungrouped channels exist */}
      {localSectionsWithChannels.length === 0 &&
        localChannelsWithoutSection.length > 0 &&
        role !== MemberRole.GUEST && (
          <div className='px-3 py-4 text-center'>
            <p className='text-xs text-gray-500 mb-2'>
              Create sections to organize your channels better!
            </p>
          </div>
        )}
    </div>
  );
}
