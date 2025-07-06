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
        <div className='flex flex-col space-y-0.5 ml-4 overflow-visible relative z-10'>
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

  // Debug logging
  useEffect(() => {}, [
    channelsWithoutSection,
    sectionsWithChannels,
    server,
    role,
    isTextChannelsCollapsed,
  ]);

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
        if (isCollapsed !== null) {
          setIsTextChannelsCollapsed(JSON.parse(isCollapsed));
        } else {
          // Default to expanded (false) if no saved state
          setIsTextChannelsCollapsed(false);
        }
      } catch (error) {
        // Fallback to expanded state on error
        setIsTextChannelsCollapsed(false);
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
      if (typeof window !== 'undefined' && server) {
        try {
          localStorage.setItem(
            `collapsed-sections-${server.id}`,
            JSON.stringify(Array.from(newState))
          );
        } catch (error) {
          console.error('Failed to save collapsed state:', error);
        }
      }
    },
    [server]
  );

  const saveTextChannelsCollapsedState = useCallback(
    (isCollapsed: boolean) => {
      if (typeof window !== 'undefined' && server) {
        try {
          localStorage.setItem(
            `text-channels-collapsed-${server.id}`,
            JSON.stringify(isCollapsed)
          );
        } catch (error) {
          console.error('Failed to save text channels collapsed state:', error);
        }
      }
    },
    [server]
  );

  const saveDefaultSectionPosition = useCallback(
    (position: number) => {
      if (typeof window !== 'undefined' && server) {
        try {
          localStorage.setItem(
            `default-section-pos-${server.id}`,
            JSON.stringify(position)
          );
        } catch (error) {
          console.error('Failed to save default section position:', error);
        }
      }
    },
    [server]
  );

  const toggleSection = useCallback(
    (sectionId: string) => {
      setCollapsedSections(prev => {
        const newState = new Set(prev);
        if (newState.has(sectionId)) {
          newState.delete(sectionId);
        } else {
          newState.add(sectionId);
        }
        saveCollapsedState(newState);
        return newState;
      });
    },
    [saveCollapsedState]
  );

  const toggleTextChannels = useCallback(() => {
    setIsTextChannelsCollapsed(prev => {
      const newState = !prev;
      saveTextChannelsCollapsedState(newState);
      return newState;
    });
  }, [saveTextChannelsCollapsedState]);

  // DND Handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    // Store the active item for drag operations
    console.log('Drag start:', active.id);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    // Handle drag over logic
    console.log('Drag over:', active.id, 'over:', over.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    // Handle drag end logic - reorder items
    console.log('Drag end:', active.id, 'over:', over.id);
  };

  // Register drag and drop handlers with provider
  useEffect(() => {
    setOptimisticCallbacks({
      onChannelReorder: (
        channelId: string,
        newPosition: number,
        newSectionId?: string | null
      ) => {
        console.log('Channel reorder:', channelId, newPosition, newSectionId);
        // Handle channel reordering logic here
      },
      onSectionReorder: (
        sectionId: string,
        newPosition: number,
        newParentId?: string | null
      ) => {
        console.log('Section reorder:', sectionId, newPosition, newParentId);
        // Handle section reordering logic here
      },
    });
  }, [setOptimisticCallbacks]);

  // Memoized components for rendering
  const textChannelsComponent = useMemo(
    () => ({
      id: 'text-channels',
      position: defaultSectionPosition,
      component: (
        <div key='text-channels' className='overflow-visible'>
          {localChannelsWithoutSection.length > 0 && (
            <div className='overflow-visible'>
              <ServerSectionHeader
                sectionType='channels'
                role={role}
                label='Text Channels'
                server={server}
                channelType={ChannelType.TEXT}
                isCollapsed={isTextChannelsCollapsed}
                onToggleCollapse={toggleTextChannels}
              />
              <div className='flex flex-col space-y-0.5 ml-4 overflow-visible relative z-10'>
                <SortableContext
                  items={localChannelsWithoutSection.map(
                    (channel: any) => `channel-${channel.id}`
                  )}
                  strategy={verticalListSortingStrategy}
                >
                  {localChannelsWithoutSection.map((channel: any) => (
                    <div key={channel.id} className='overflow-visible'>
                      <ServerChannel
                        channel={channel}
                        server={server}
                        role={role}
                      />
                    </div>
                  ))}
                </SortableContext>
              </div>
            </div>
          )}
        </div>
      ),
    }),
    [
      defaultSectionPosition,
      localChannelsWithoutSection,
      role,
      server,
      isTextChannelsCollapsed,
      toggleTextChannels,
    ]
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
    <div className='space-y-1.5 overflow-visible'>
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
