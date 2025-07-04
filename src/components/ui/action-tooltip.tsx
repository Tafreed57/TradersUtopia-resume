'use client';

import React from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ActionTooltipProps {
  label: string;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}

export function ActionTooltip({
  label,
  children,
  side,
  align,
}: ActionTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={50}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          className='bg-gray-900/95 backdrop-blur-sm border-gray-700/50 text-gray-100 text-xs px-2 py-1 shadow-xl'
          style={{ zIndex: 99999 }}
          sideOffset={8}
          collisionPadding={12}
          avoidCollisions={true}
          sticky='partial'
        >
          <p className='font-medium'>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
