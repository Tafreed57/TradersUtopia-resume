'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChannelType, Role } from '@prisma/client';
import { ServerSectionHeader } from '@/components/server-section-header';
import { ServerChannel } from '@/components/server-channel';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

interface SectionContentProps {
  server: any;
  role: Role | undefined;
  channelsWithoutSection: any[];
  sectionsWithChannels: any[];
}

// Recursive section component to handle nested sections
function SectionItem({
  section,
  server,
  role,
  depth = 0,
}: {
  section: any;
  server: any;
  role: Role | undefined;
  depth?: number;
}) {
  const marginLeft = `${depth * 1.5}rem`;
  const isDefaultSection = section.isDefaultSection || false;

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
          sectionType={isDefaultSection ? 'channels' : 'section'}
          role={role}
          label={section.name}
          server={server}
          section={isDefaultSection ? undefined : section}
          channelType={isDefaultSection ? ChannelType.TEXT : undefined}
          position={section.position}
        />
      </div>
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
                <ServerChannel channel={channel} server={server} role={role} />
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
    </div>
  );
}

export function SectionContent({
  server,
  role,
  channelsWithoutSection,
  sectionsWithChannels,
}: SectionContentProps) {
  const [localChannelsWithoutSection, setLocalChannelsWithoutSection] =
    useState(channelsWithoutSection);
  const [localSectionsWithChannels, setLocalSectionsWithChannels] =
    useState(sectionsWithChannels);

  // Update local state when props change
  useEffect(() => {
    setLocalChannelsWithoutSection(channelsWithoutSection);
    setLocalSectionsWithChannels(sectionsWithChannels);
  }, [channelsWithoutSection, sectionsWithChannels]);

  // Real-time channel deletion event listener
  useEffect(() => {
    const handleChannelDeleted = (event: CustomEvent) => {
      const { channelId, serverId, sectionId } = event.detail;

      // Only handle deletions for the current server
      if (serverId !== server?.id) return;

      if (sectionId) {
        // Remove channel from a specific section
        setLocalSectionsWithChannels(prev =>
          prev.map(section => ({
            ...section,
            channels: section.channels.filter(
              (channel: any) => channel.id !== channelId
            ),
            children:
              section.children?.map((childSection: any) => ({
                ...childSection,
                channels: childSection.channels.filter(
                  (channel: any) => channel.id !== channelId
                ),
              })) || [],
          }))
        );
      } else {
        // Remove channel from channels without section
        setLocalChannelsWithoutSection(prev =>
          prev.filter(channel => channel.id !== channelId)
        );
      }
    };

    const handleChannelDeleteError = (event: CustomEvent) => {
      const { channelId, error } = event.detail;
      console.error(`Failed to delete channel ${channelId}:`, error);
      // You could add toast notification here if desired
    };

    // Add event listeners
    window.addEventListener(
      'channel-deleted',
      handleChannelDeleted as EventListener
    );
    window.addEventListener(
      'channel-delete-error',
      handleChannelDeleteError as EventListener
    );

    // Cleanup event listeners
    return () => {
      window.removeEventListener(
        'channel-deleted',
        handleChannelDeleted as EventListener
      );
      window.removeEventListener(
        'channel-delete-error',
        handleChannelDeleteError as EventListener
      );
    };
  }, [server?.id]);

  // Create a unified list of all sections including the default section for ungrouped channels
  const allSections = useMemo(() => {
    const sections = [...localSectionsWithChannels];

    // Add the default section for ungrouped channels if there are any
    if (localChannelsWithoutSection.length > 0) {
      const defaultSection = {
        id: 'default-section',
        name: server?.defaultSectionName || 'Text Channels',
        position: -1, // Always show first
        channels: localChannelsWithoutSection,
        isDefaultSection: true,
      };
      sections.unshift(defaultSection);
    }

    return sections.sort((a, b) => a.position - b.position);
  }, [
    localSectionsWithChannels,
    localChannelsWithoutSection,
    server?.defaultSectionName,
  ]);

  return (
    <div className='space-y-1.5 overflow-visible'>
      {/* Combined sortable context for all sections including default */}
      <SortableContext
        items={allSections.map(section => section.id)}
        strategy={verticalListSortingStrategy}
      >
        {/* Render all sections in the correct sorted order */}
        {allSections.map(section => (
          <SectionItem
            key={section.id}
            section={section}
            server={server}
            role={role}
          />
        ))}
      </SortableContext>

      {/* Show create section prompt if no sections exist and no ungrouped channels */}
      {localSectionsWithChannels.length === 0 &&
        localChannelsWithoutSection.length === 0 &&
        role?.name !== 'free' && (
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
        role?.name !== 'free' && (
          <div className='px-3 py-4 text-center'>
            <p className='text-xs text-gray-500 mb-2'>
              Create sections to organize your channels better!
            </p>
          </div>
        )}
    </div>
  );
}
