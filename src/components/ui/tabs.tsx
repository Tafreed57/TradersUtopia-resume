'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center bg-gradient-to-r from-gray-900/90 via-gray-900/80 to-gray-900/90 backdrop-blur-xl border border-gray-600/40 shadow-2xl rounded-xl sm:rounded-2xl p-1.5 sm:p-2 text-gray-300 min-h-[50px] sm:min-h-[60px] w-full max-w-fit relative overflow-hidden',
      'before:absolute before:inset-0 before:bg-gradient-to-r before:from-blue-500/5 before:via-purple-500/5 before:to-blue-500/5 before:opacity-0 before:transition-opacity before:duration-500 hover:before:opacity-100',
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-lg sm:rounded-xl px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-xs sm:text-sm md:text-base font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 relative z-10 min-h-[44px] sm:min-h-[48px] touch-manipulation group',
      'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 hover:shadow-lg hover:scale-105 hover:shadow-black/20',
      'data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:via-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-xl data-[state=active]:shadow-blue-500/30 data-[state=active]:border data-[state=active]:border-blue-400/50 data-[state=active]:scale-105',
      'before:absolute before:inset-0 before:bg-gradient-to-r before:from-white/5 before:via-white/10 before:to-white/5 before:opacity-0 before:transition-opacity before:duration-300 data-[state=active]:before:opacity-100',
      'after:absolute after:inset-0 after:bg-gradient-to-t after:from-black/10 after:to-transparent after:opacity-0 after:transition-opacity after:duration-300 hover:after:opacity-100',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-4 sm:mt-6 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 animate-in fade-in-0 duration-300',
      'bg-gradient-to-br from-gray-800/60 via-gray-900/50 to-gray-900/70 backdrop-blur-md border border-gray-600/30 rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8',
      'before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/5 before:via-transparent before:to-white/5 before:opacity-50 before:pointer-events-none before:rounded-xl sm:before:rounded-2xl',
      'relative overflow-hidden',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
