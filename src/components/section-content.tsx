'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChannelType, MemberRole } from '@prisma/client';
import { ServerSectionHeader } from '@/components/server-section-header';
import { ServerChannel } from '@/components/server-channel';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDragDrop } from '@/contexts/drag-drop-provider';

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
          onToggleCollapse={() => toggleSection(section.id)}
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

  // Initialize with default values to avoid hydration mismatch
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set()
  );
  const [isTextChannelsCollapsed, setIsTextChannelsCollapsed] = useState(false);
  const [defaultSectionPosition, setDefaultSectionPosition] = useState(0);

  // Flag to track if we've loaded from localStorage yet (prevents overwriting on initial render)
  const hasLoadedFromStorage = useRef(false);

  // Load from localStorage after hydration
  useEffect(() => {
    if (typeof window !== 'undefined' && server?.id) {
      console.log(
        '🔄 Loading collapsed states from localStorage for server:',
        server.id
      );

      // Load collapsed sections
      const savedCollapsed = localStorage.getItem(
        `collapsedSections_${server.id}`
      );
      if (savedCollapsed) {
        const collapsed = new Set(JSON.parse(savedCollapsed) as string[]);
        console.log('📂 Loaded collapsed sections:', Array.from(collapsed));
        setCollapsedSections(collapsed);
      } else {
        console.log('📂 No saved collapsed sections found');
      }

      // Load text channels collapsed state
      const savedTextCollapsed = localStorage.getItem(
        `isTextChannelsCollapsed_${server.id}`
      );
      if (savedTextCollapsed) {
        const isCollapsed = JSON.parse(savedTextCollapsed);
        console.log('📂 Loaded text channels collapsed state:', isCollapsed);
        setIsTextChannelsCollapsed(isCollapsed);
      } else {
        console.log('📂 No saved text channels collapsed state found');
      }

      // Load default section position
      const savedPosition = localStorage.getItem(
        `defaultSectionPosition_${server.id}`
      );
      if (savedPosition) {
        const position = parseInt(savedPosition, 10);
        console.log('📂 Loaded default section position:', position);
        setDefaultSectionPosition(position);
      } else {
        console.log('📂 No saved default section position found');
      }
    }
  }, [server?.id]);

  // Enable saving after state updates have been applied
  useEffect(() => {
    if (typeof window !== 'undefined' && server?.id) {
      // Small delay to ensure all state updates have been applied
      const timer = setTimeout(() => {
        hasLoadedFromStorage.current = true;
      }, 100); // 100ms delay

      return () => clearTimeout(timer);
    }
  }, [
    collapsedSections,
    isTextChannelsCollapsed,
    defaultSectionPosition,
    server?.id,
  ]);

  // Save collapsed state to localStorage (with loading flag check)
  useEffect(() => {
    if (hasLoadedFromStorage.current && server?.id) {
      const timeout = setTimeout(() => {
        localStorage.setItem(
          `collapsedSections_${server.id}`,
          JSON.stringify(Array.from(collapsedSections))
        );
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [collapsedSections, server?.id]);

  // Save text channels collapsed state to localStorage (with loading flag check)
  useEffect(() => {
    if (hasLoadedFromStorage.current && server?.id) {
      localStorage.setItem(
        `textChannelsCollapsed_${server.id}`,
        JSON.stringify(isTextChannelsCollapsed)
      );
    }
  }, [isTextChannelsCollapsed, server?.id]);

  // Save default section position to localStorage (with loading flag check)
  useEffect(() => {
    if (hasLoadedFromStorage.current && server?.id) {
      localStorage.setItem(
        `defaultSectionPosition_${server.id}`,
        defaultSectionPosition.toString()
      );
    }
  }, [defaultSectionPosition, server?.id]);

  // Local state for optimistic updates
  const [localChannelsWithoutSection, setLocalChannelsWithoutSection] =
    useState(channelsWithoutSection);
  const [localSectionsWithChannels, setLocalSectionsWithChannels] =
    useState(sectionsWithChannels);

  // Update local state when props change (e.g., on page refresh)
  useEffect(() => {
    setLocalChannelsWithoutSection(channelsWithoutSection);
    setLocalSectionsWithChannels(sectionsWithChannels);
  }, [channelsWithoutSection, sectionsWithChannels]);

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const toggleTextChannels = () => {
    setIsTextChannelsCollapsed(prev => !prev);
  };

  // Callback to handle section reordering
  const reorderSections = useCallback(
    (sectionId: string, newPosition: number, newParentId?: string | null) => {
      // Handle default section position updates
      if (sectionId === 'default') {
        setDefaultSectionPosition(newPosition);

        // When default section moves, rebuild all positions to avoid conflicts
        setLocalSectionsWithChannels(prevSections => {
          // Rebuild regular sections with clean positions
          let regularSectionPosition = 0;
          const result = prevSections.map(section => {
            // Skip positions occupied by default section
            while (regularSectionPosition === newPosition) {
              regularSectionPosition++;
            }

            const newPos = regularSectionPosition++;
            return { ...section, position: newPos };
          });

          return result;
        });
        return;
      }

      // Handle regular section reordering - REBUILD ALL POSITIONS
      setLocalSectionsWithChannels(prevSections => {
        // Find the section being moved
        const targetSection = prevSections.find(s => s.id === sectionId);
        if (!targetSection) {
          return prevSections;
        }

        // Adjust newPosition to account for default section in combined array
        let adjustedPosition = newPosition;

        // If the default section comes before this position, we need to subtract 1
        if (defaultSectionPosition < newPosition) {
          adjustedPosition = newPosition - 1;
        }

        // Find current index of the section being moved in regular sections array
        const currentIndex = prevSections.findIndex(s => s.id === sectionId);

        // Remove the section being moved first
        const otherSections = prevSections.filter(s => s.id !== sectionId);

        // Create the moved section with updated parentId
        const movedSection = {
          ...targetSection,
          parentId: newParentId,
        };

        // Adjust insertion index based on movement direction in the regular sections array
        let insertIndex = adjustedPosition;

        // Ensure index is within bounds of regular sections array
        const maxIndex = otherSections.length;
        insertIndex = Math.max(0, Math.min(insertIndex, maxIndex));

        // Insert the moved section at the correct position
        const allSections = [...otherSections];
        allSections.splice(insertIndex, 0, movedSection);

        // Now assign clean sequential positions, handling conflicts with default section
        let currentPosition = 0;
        const finalSections = allSections.map((section, index) => {
          // If this position conflicts with default section, we need to handle it
          if (currentPosition === defaultSectionPosition) {
            // Check if this is the section that was actually dragged to this position
            const isTargetSection = section.id === sectionId;

            if (isTargetSection) {
              // This section was dragged to this specific position - it should get it
              // Move default section to next position
              setDefaultSectionPosition(currentPosition + 1);

              const cleanedSection = {
                ...section,
                position: currentPosition,
              };
              currentPosition++;
              return cleanedSection;
            } else {
              // This section is not the target, skip the conflict
              currentPosition++;
            }
          }

          const cleanedSection = {
            ...section,
            position: currentPosition,
          };
          currentPosition++;
          return cleanedSection;
        });

        return finalSections;
      });
    },
    [defaultSectionPosition]
  );

  // Callback to handle channel reordering
  const reorderChannels = useCallback(
    (channelId: string, newPosition: number, newSectionId?: string | null) => {
      // Find the source channel and its current location
      let sourceChannel = null;
      let sourceLocation = null;

      // Check if channel is currently in unsectioned area
      sourceChannel = localChannelsWithoutSection.find(c => c.id === channelId);
      if (sourceChannel) {
        sourceLocation = 'unsectioned';
      } else {
        // Check if channel is in a section
        for (const section of localSectionsWithChannels) {
          const channel = section.channels.find((c: any) => c.id === channelId);
          if (channel) {
            sourceChannel = channel;
            sourceLocation = section.id;
            break;
          }
        }
      }

      if (!sourceChannel) {
        console.error('Source channel not found:', channelId);
        return;
      }

      // Case 1: Moving to unsectioned area
      if (newSectionId === null) {
        // Remove from source
        if (sourceLocation === 'unsectioned') {
          // Reordering within unsectioned channels
          setLocalChannelsWithoutSection(prevChannels => {
            const channels = [...prevChannels];
            const sourceIndex = channels.findIndex(c => c.id === channelId);
            if (sourceIndex === -1) return prevChannels;

            // Remove from current position
            const [movedChannel] = channels.splice(sourceIndex, 1);

            // Insert at new position
            channels.splice(newPosition, 0, {
              ...movedChannel,
              position: newPosition,
              sectionId: null,
            });

            // Update positions for all channels
            return channels.map((channel, index) => ({
              ...channel,
              position: index,
            }));
          });
        } else {
          // Moving from section to unsectioned
          // Remove from source section
          setLocalSectionsWithChannels(prevSections => {
            return prevSections.map(section => {
              if (section.id === sourceLocation) {
                return {
                  ...section,
                  channels: section.channels.filter(
                    (c: any) => c.id !== channelId
                  ),
                };
              }
              return section;
            });
          });

          // Add to unsectioned channels
          setLocalChannelsWithoutSection(prevChannels => {
            const channels = [...prevChannels];
            const updatedChannel = {
              ...sourceChannel,
              position: newPosition,
              sectionId: null,
            };

            // Insert at new position
            channels.splice(newPosition, 0, updatedChannel);

            // Update positions for all channels
            return channels.map((channel, index) => ({
              ...channel,
              position: index,
            }));
          });
        }
      } else {
        // Case 2: Moving to a section
        const targetSectionId = newSectionId;

        // Remove from source
        if (sourceLocation === 'unsectioned') {
          // Remove from unsectioned channels
          setLocalChannelsWithoutSection(prevChannels => {
            return prevChannels.filter(c => c.id !== channelId);
          });
        } else if (sourceLocation !== targetSectionId) {
          // Remove from source section (if different from target)
          setLocalSectionsWithChannels(prevSections => {
            return prevSections.map(section => {
              if (section.id === sourceLocation) {
                return {
                  ...section,
                  channels: section.channels.filter(
                    (c: any) => c.id !== channelId
                  ),
                };
              }
              return section;
            });
          });
        }

        // Add to target section
        setLocalSectionsWithChannels(prevSections => {
          return prevSections.map(section => {
            if (section.id === targetSectionId) {
              const channels = [...section.channels];
              const updatedChannel = {
                ...sourceChannel,
                position: newPosition,
                sectionId: targetSectionId,
              };

              if (sourceLocation === targetSectionId) {
                // Reordering within same section
                const sourceIndex = channels.findIndex(c => c.id === channelId);
                if (sourceIndex !== -1) {
                  // Remove from current position
                  channels.splice(sourceIndex, 1);
                }
              }

              // Insert at new position
              channels.splice(newPosition, 0, updatedChannel);

              // Update positions for all channels in this section
              const updatedChannels = channels.map((channel, index) => ({
                ...channel,
                position: index,
              }));

              return { ...section, channels: updatedChannels };
            }
            return section;
          });
        });
      }
    },
    [localChannelsWithoutSection, localSectionsWithChannels]
  );

  // Register optimistic update callbacks after functions are defined
  useEffect(() => {
    if (setOptimisticCallbacks) {
      setOptimisticCallbacks({
        onSectionReorder: reorderSections,
        onChannelReorder: reorderChannels,
      });
    }
  }, [setOptimisticCallbacks, reorderSections, reorderChannels]);

  // ✅ NEW: Get custom default section name or fallback to "Text Channels"
  const defaultSectionName = server?.defaultSectionName || 'Text Channels';

  // Filter out child sections from root level (those with parentId will be rendered under their parents)
  const rootSections = localSectionsWithChannels.filter(
    (section: any) => !section.parentId
  );

  // Create an ordered list of all sections including the default section
  const allSections = [];

  // Add default section if it has channels
  if (localChannelsWithoutSection.length > 0) {
    allSections.push({
      id: 'default-section',
      type: 'default',
      position: defaultSectionPosition,
      component: (
        <div
          key='default-section'
          className='relative overflow-visible'
          style={{ zIndex: 100 }}
        >
          <div className='overflow-visible'>
            <ServerSectionHeader
              sectionType='channels'
              channelType={ChannelType.TEXT}
              role={role}
              label={defaultSectionName}
              server={server}
              isCollapsed={isTextChannelsCollapsed}
              onToggleCollapse={toggleTextChannels}
              position={defaultSectionPosition}
            />
          </div>
          {!isTextChannelsCollapsed && (
            <div className='flex flex-col space-y-1 ml-4 overflow-visible relative z-10'>
              <SortableContext
                items={localChannelsWithoutSection.map(
                  (channel: any) => `channel-${channel.id}`
                )}
                strategy={verticalListSortingStrategy}
              >
                {localChannelsWithoutSection.map(channel => (
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
          )}
        </div>
      ),
    });
  }

  // Add regular sections
  rootSections.forEach((section: any, index: number) => {
    allSections.push({
      id: section.id,
      type: 'section',
      position: section.position || index,
      component: (
        <div
          key={section.id}
          className='relative overflow-visible'
          style={{ zIndex: 99 - index }}
        >
          <SectionItem
            section={section}
            server={server}
            role={role}
            collapsedSections={collapsedSections}
            toggleSection={toggleSection}
            depth={0}
          />
        </div>
      ),
    });
  });

  // Sort all sections by position for proper ordering
  allSections.sort((a, b) => a.position - b.position);

  // Create sortable IDs in the correct order based on sorted sections
  const allSortableIds = allSections.map(section =>
    section.type === 'default' ? 'default-section' : `section-${section.id}`
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
