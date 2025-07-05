'use client';
import { ActionTooltip } from '@/components/ui/action-tooltip';
import { useStore } from '@/store/store';
import { ServerWithMembersWithProfiles } from '@/types/server';
import { ChannelType, MemberRole, Section, Channel } from '@prisma/client';
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Settings,
  Edit,
  Trash2,
  MoreHorizontal,
  GripVertical,
} from 'lucide-react';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

interface ServerSectionHeaderProps {
  label: string;
  role?: MemberRole;
  sectionType: 'channels' | 'section';
  channelType?: ChannelType;
  server?: ServerWithMembersWithProfiles;
  section?: Section & { channels: Channel[] };
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  position?: number;
}

export function ServerSectionHeader({
  label,
  role,
  sectionType,
  channelType,
  server,
  section,
  isCollapsed = false,
  onToggleCollapse,
  position,
}: ServerSectionHeaderProps) {
  const onOpen = useStore.use.onOpen();
  const [isHovered, setIsHovered] = useState(false);

  const canManage = role !== MemberRole.GUEST;

  // Enable drag and drop for both regular sections and the default "channels" section
  const isDraggable =
    canManage &&
    ((sectionType === 'section' && section) || sectionType === 'channels');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: isDraggable
      ? sectionType === 'section'
        ? `section-${section?.id || 'unknown'}`
        : 'default-section'
      : `non-draggable-${section?.id || 'default'}`,
    disabled: !isDraggable,
    data: {
      type: sectionType === 'channels' ? 'default-section' : 'section',
      section: sectionType === 'section' ? section : null,
      serverId: server?.id,
      position: position !== undefined ? position : section?.position || 0,
      parentId: null,
      name: label,
      isDefaultSection: sectionType === 'channels',
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div className='relative mb-2 z-20'>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'flex items-center justify-between px-3 py-2 bg-gradient-to-r from-gray-800/30 to-gray-700/30 rounded-xl border border-gray-700/30 backdrop-blur-sm hover:bg-gradient-to-r hover:from-gray-700/40 hover:to-gray-600/40 transition-all duration-200 group cursor-pointer',
          isDragging && 'opacity-50 scale-95',
          isDraggable && 'hover:border-blue-400/30'
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className='flex items-center text-xs font-bold uppercase tracking-wider text-gray-300 gap-2 flex-1 min-w-0 mr-2'>
          {isDraggable && (
            <div
              {...attributes}
              {...listeners}
              className='relative flex-shrink-0 z-[60] cursor-grab active:cursor-grabbing'
              onClick={e => {
                // Prevent the drag handle from triggering the collapse toggle
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <ActionTooltip label='Drag to reorder section' side='top'>
                <div className='p-1 rounded transition-all duration-200 hover:bg-gray-600/30 relative z-[60]'>
                  <GripVertical className='w-3 h-3 text-gray-400 group-hover:text-blue-400 transition-colors' />
                </div>
              </ActionTooltip>
            </div>
          )}

          <div
            className='relative flex-shrink-0 z-[60] cursor-pointer'
            onClick={e => {
              e.stopPropagation();
              onToggleCollapse?.();
            }}
          >
            <ActionTooltip
              label={isCollapsed ? 'Expand Section' : 'Collapse Section'}
              side='top'
            >
              <div className='p-1 rounded transition-all duration-200 hover:bg-gray-600/30 relative z-[60]'>
                {isCollapsed ? (
                  <ChevronRight className='w-3 h-3 text-gray-400 group-hover:text-gray-200 transition-colors' />
                ) : (
                  <ChevronDown className='w-3 h-3 text-gray-400 group-hover:text-gray-200 transition-colors' />
                )}
              </div>
            </ActionTooltip>
          </div>

          {sectionType === 'channels' && (
            <div className='w-2 h-2 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex-shrink-0' />
          )}
          <span className='select-none flex-1 min-w-0'>{label}</span>
          {sectionType === 'section' && section && (
            <span className='text-xs text-gray-500 font-normal flex-shrink-0 ml-1'>
              ({section.channels?.length || 0})
            </span>
          )}
        </div>

        {canManage && (
          <div className='flex items-center gap-1 flex-shrink-0'>
            <div className='relative z-[55]'>
              <ActionTooltip label='Create Channel' side='top'>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onOpen('createChannel', {
                      channelType,
                      server,
                      section: sectionType === 'section' ? section : undefined,
                    });
                  }}
                  className={`flex items-center justify-center w-6 h-6 text-gray-400 hover:text-blue-400 transition-all duration-200 rounded-md hover:bg-blue-600/20 border border-transparent hover:border-blue-400/30 relative z-[55] ${
                    isHovered
                      ? 'opacity-100'
                      : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <Plus className='h-3 w-3' />
                </button>
              </ActionTooltip>
            </div>

            <div className='relative z-[100]'>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`flex items-center justify-center w-6 h-6 text-gray-400 hover:text-gray-200 transition-all duration-200 rounded-md hover:bg-gray-600/20 border border-transparent hover:border-gray-400/30 relative z-[60] ${
                      isHovered
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100'
                    }`}
                    onClick={e => e.stopPropagation()}
                  >
                    <MoreHorizontal className='h-3 w-3' />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuPortal>
                  <DropdownMenuContent
                    side='bottom'
                    align='end'
                    className='w-48 bg-gray-900/98 backdrop-blur-md border border-gray-700/50 shadow-2xl'
                    style={{ zIndex: 99999 }}
                    sideOffset={8}
                    alignOffset={-8}
                  >
                    {sectionType === 'channels' && (
                      <>
                        <DropdownMenuItem
                          onClick={e => {
                            e.stopPropagation();
                            onOpen('editDefaultSection', { server });
                          }}
                          className='flex items-center gap-2 text-gray-300 hover:text-yellow-400 hover:bg-yellow-600/10 cursor-pointer px-3 py-2'
                        >
                          <Edit className='h-3 w-3' />
                          Edit Section Name
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={e => {
                            e.stopPropagation();
                            onOpen('createSection', { server });
                          }}
                          className='flex items-center gap-2 text-gray-300 hover:text-green-400 hover:bg-green-600/10 cursor-pointer px-3 py-2'
                        >
                          <Settings className='h-3 w-3' />
                          Create Section
                        </DropdownMenuItem>
                      </>
                    )}

                    {sectionType === 'section' && section && (
                      <>
                        <DropdownMenuItem
                          onClick={e => {
                            e.stopPropagation();
                            onOpen('editSection', { server, section });
                          }}
                          className='flex items-center gap-2 text-gray-300 hover:text-yellow-400 hover:bg-yellow-600/10 cursor-pointer px-3 py-2'
                        >
                          <Edit className='h-3 w-3' />
                          Edit Section
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={e => {
                            e.stopPropagation();
                            // TODO: Add delete section functionality
                            console.log('Delete section:', section.id);
                          }}
                          className='flex items-center gap-2 text-gray-300 hover:text-red-400 hover:bg-red-600/10 cursor-pointer px-3 py-2'
                        >
                          <Trash2 className='h-3 w-3' />
                          Delete Section
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenuPortal>
              </DropdownMenu>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
