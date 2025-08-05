'use client';

import {
  ServerDataProvider,
  useServerData,
} from '@/contexts/server-data-provider';
import { useExtendedUser } from '@/contexts/session-provider';

const ServerIdLayout = ({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { serverId: string };
}) => {
  const { isLoaded, user, hasAccess, isAdmin, isLoading } = useExtendedUser();

  // Show loading state while checking auth
  if (!isLoaded || isLoading) {
    return (
      <div className='h-full flex items-center justify-center bg-gray-900'>
        <div className='text-center'>
          <div className='w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin mx-auto mb-4' />
          <p className='text-gray-400'>Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if user doesn't have access and isn't admin
  if (!user || (!hasAccess && !isAdmin)) {
    return null;
  }

  return (
    <ServerDataProvider serverId={params.serverId}>
      <ServerLayoutContent serverId={params.serverId}>
        {children}
      </ServerLayoutContent>
    </ServerDataProvider>
  );
};

// Separate component that uses server data context
function ServerLayoutContent({
  children,
  serverId,
}: {
  children: React.ReactNode;
  serverId: string;
}) {
  const { server, isLoading, error } = useServerData();

  // Show loading state while fetching server data
  if (isLoading) {
    return (
      <div className='h-full flex items-center justify-center bg-gray-900'>
        <div className='text-center'>
          <div className='w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin mx-auto mb-4' />
          <p className='text-gray-400'>Loading server...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !server) {
    return (
      <div className='h-full flex items-center justify-center bg-gray-900'>
        <div className='text-center'>
          <p className='text-red-400 mb-2'>Failed to load server</p>
          <p className='text-gray-400 text-sm'>{error || 'Server not found'}</p>
        </div>
      </div>
    );
  }

  return <div className='h-full'>{children}</div>;
}

export default ServerIdLayout;
