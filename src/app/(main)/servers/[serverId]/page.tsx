'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { ServerSideBar } from '@/components/layout/server-side-bar';
import { ChannelContent } from '@/components/server/channel-content';
import { useServerData } from '@/contexts/server-data-provider';
import { useResizableSidebar } from '@/hooks/use-resizable-sidebar';
import { Loader2 } from 'lucide-react';

interface ServerIdPageProps {
  params: {
    serverId: string;
  };
}

function ServerPageContent({ serverId }: { serverId: string }) {
  const searchParams = useSearchParams();
  const { server, isLoading: serverLoading } = useServerData();
  const { width: sidebarWidth } = useResizableSidebar({
    minWidth: 240,
    maxWidth: 600,
    defaultWidth: 320,
    localStorageKey: 'server-sidebar-width',
  });

  // Get channel from URL params or default to first channel
  const urlChannelId = searchParams.get('channel');
  const [activeChannelId, setActiveChannelId] = useState<string | null>(
    urlChannelId
  );

  // Track window size for responsive sidebar padding
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const checkWindowSize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    // Set initial value
    checkWindowSize();

    // Listen for window resize
    window.addEventListener('resize', checkWindowSize);

    return () => window.removeEventListener('resize', checkWindowSize);
  }, []);

  // Set default channel when server loads
  useEffect(() => {
    if (server && !urlChannelId && !activeChannelId) {
      const defaultChannel = server.channels?.[0]?.id;
      if (defaultChannel) {
        setActiveChannelId(defaultChannel);
        // Update URL without causing a page reload
        const newUrl = `/servers/${serverId}?channel=${defaultChannel}`;
        window.history.replaceState(null, '', newUrl);
      }
    }
  }, [server, urlChannelId, activeChannelId, serverId]);

  // Update active channel when URL changes (browser back/forward)
  useEffect(() => {
    if (urlChannelId && urlChannelId !== activeChannelId) {
      setActiveChannelId(urlChannelId);
    }
  }, [urlChannelId, activeChannelId]);

  // Handle browser back/forward navigation with popstate
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const channelFromUrl = params.get('channel');
      if (channelFromUrl && channelFromUrl !== activeChannelId) {
        setActiveChannelId(channelFromUrl);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeChannelId]);

  // Channel switching function with true shallow routing
  const handleChannelSwitch = useCallback(
    (channelId: string) => {
      if (channelId === activeChannelId) return; // No-op if already active

      // Update local state immediately for instant UI feedback
      setActiveChannelId(channelId);

      // Update URL without page reload using native History API
      const newUrl = `/servers/${serverId}?channel=${channelId}`;
      window.history.pushState(null, '', newUrl);
    },
    [activeChannelId, serverId]
  );

  // Loading state for server data only
  if (serverLoading) {
    return (
      <div className='h-full flex items-center justify-center bg-gray-900'>
        <div className='text-center'>
          <Loader2 className='w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin mx-auto mb-4' />
          <p className='text-gray-400'>Loading server...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='h-full flex'>
      {/* Sidebar - persistent, never unmounts */}
      <div className='hidden md:flex h-full z-20 flex-col fixed inset-y-0'>
        <ServerSideBar
          serverId={serverId}
          onChannelClick={handleChannelSwitch}
          activeChannelId={activeChannelId}
        />
      </div>

      {/* Main content area */}
      <div
        className='flex-1'
        style={{
          paddingLeft: isDesktop ? `${sidebarWidth}px` : '0px',
        }}
      >
        <ChannelContent
          channelId={activeChannelId}
          serverId={serverId}
          onChannelClick={handleChannelSwitch}
          activeChannelId={activeChannelId}
        />
      </div>
    </div>
  );
}

export default function ServerIdPage({ params }: ServerIdPageProps) {
  return (
    <Suspense
      fallback={
        <div className='h-full flex items-center justify-center bg-gray-900'>
          <Loader2 className='w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin' />
        </div>
      }
    >
      <ServerPageContent serverId={params.serverId} />
    </Suspense>
  );
}
