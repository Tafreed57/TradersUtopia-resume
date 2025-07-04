'use client';

import { useState } from 'react';
import { ChannelType, MemberRole } from '@prisma/client';
import { ServerSectionHeader } from '@/components/server-section-header';
import { ServerChannel } from '@/components/server-channel';

interface SectionContentProps {
  server: any;
  role: MemberRole | undefined;
  channelsWithoutSection: any[];
  sectionsWithChannels: any[];
}

export function SectionContent({
  server,
  role,
  channelsWithoutSection,
  sectionsWithChannels,
}: SectionContentProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set()
  );
  const [isTextChannelsCollapsed, setIsTextChannelsCollapsed] = useState(false);

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

  // ✅ NEW: Get custom default section name or fallback to "Text Channels"
  const defaultSectionName = server?.defaultSectionName || 'Text Channels';

  return (
    <div className='space-y-3 overflow-visible'>
      {/* ✅ NEW: Display sections with their channels */}
      {sectionsWithChannels.map((section, index) => (
        <div
          key={section.id}
          className='relative overflow-visible'
          style={{ zIndex: 100 - index }}
        >
          <div className='overflow-visible'>
            <ServerSectionHeader
              sectionType='section'
              role={role}
              label={section.name}
              server={server}
              section={section}
              isCollapsed={collapsedSections.has(section.id)}
              onToggleCollapse={() => toggleSection(section.id)}
            />
          </div>
          {!collapsedSections.has(section.id) && (
            <div className='flex flex-col space-y-1 ml-4 overflow-visible relative z-10'>
              {section.channels.map((channel: any) => (
                <div key={channel.id} className='overflow-visible'>
                  <ServerChannel
                    channel={channel}
                    server={server}
                    role={role}
                  />
                </div>
              ))}
              {section.channels.length === 0 && (
                <p className='text-xs text-gray-500 italic px-3 py-2'>
                  No channels in this section
                </p>
              )}
            </div>
          )}
        </div>
      ))}

      {/* ✅ ENHANCED: Display channels without sections with custom name */}
      {!!channelsWithoutSection?.length && (
        <div
          className='relative overflow-visible'
          style={{ zIndex: 100 - sectionsWithChannels.length }}
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
            />
          </div>
          {!isTextChannelsCollapsed && (
            <div className='flex flex-col space-y-1 ml-4 overflow-visible relative z-10'>
              {channelsWithoutSection.map(channel => (
                <div key={channel.id} className='overflow-visible'>
                  <ServerChannel
                    channel={channel}
                    server={server}
                    role={role}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ✅ NEW: Show create section prompt if no sections exist and no ungrouped channels */}
      {sectionsWithChannels.length === 0 &&
        channelsWithoutSection.length === 0 &&
        role !== MemberRole.GUEST && (
          <div className='px-3 py-4 text-center'>
            <p className='text-xs text-gray-500 mb-2'>
              No channels or sections created yet. Create your first section to
              organize channels!
            </p>
          </div>
        )}

      {/* ✅ NEW: Show create section prompt if only ungrouped channels exist */}
      {sectionsWithChannels.length === 0 &&
        channelsWithoutSection.length > 0 &&
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
