'use client';

import React from 'react';
import { GripVertical } from 'lucide-react';
import { useResizableSidebar } from '@/hooks/use-resizable-sidebar';

interface ResizableWrapperProps {
  children: React.ReactNode;
}

export function ResizableWrapper({ children }: ResizableWrapperProps) {
  const { width, isResizing, startResizing } = useResizableSidebar({
    minWidth: 240,
    maxWidth: 600,
    defaultWidth: 320,
    localStorageKey: 'server-sidebar-width',
  });

  return (
    <div
      className='flex h-full text-primary bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl border-r border-gray-700/30 overflow-visible relative'
      style={{ width: `${width}px` }}
    >
      <div className='flex flex-col h-full w-full overflow-visible'>
        {children}
      </div>

      {/* Resize Handle */}
      <div
        className={`absolute right-0 top-0 bottom-0 w-2 cursor-col-resize group hover:bg-blue-500/20 transition-colors duration-200 ${
          isResizing ? 'bg-blue-500/30' : ''
        }`}
        onMouseDown={startResizing}
      >
        <div className='absolute right-1 top-1/2 transform -translate-y-1/2'>
          <GripVertical
            className={`h-4 w-4 text-gray-400 group-hover:text-blue-400 transition-colors duration-200 ${
              isResizing ? 'text-blue-400' : ''
            }`}
          />
        </div>
      </div>
    </div>
  );
}
