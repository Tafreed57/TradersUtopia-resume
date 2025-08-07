'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
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
  const router = useRouter();
  const { isLoaded, user, hasAccess, isAdmin, isLoading } = useExtendedUser();

  // Handle authentication redirects
  useEffect(() => {
    if (!isLoaded || isLoading) return;

    if (!user) {
      router.push('/sign-in');
      return;
    }

    if (!hasAccess && !isAdmin) {
      router.push('/pricing');
      return;
    }
  }, [isLoaded, user, hasAccess, isAdmin, isLoading, router]);

  // Show loading state while checking auth

  // Show redirecting state for unauthenticated users
  if (!user) {
    return (
      <div className='h-full flex items-center justify-center bg-gray-900'>
        <div className='text-center'>
          <div className='w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin mx-auto mb-4' />
          <p className='text-gray-400'>Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  // Show redirecting state for users without access
  if (!hasAccess && !isAdmin) {
    return (
      <div className='h-full flex items-center justify-center bg-gray-900'>
        <div className='text-center'>
          <div className='w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin mx-auto mb-4' />
          <p className='text-gray-400'>Redirecting to pricing...</p>
        </div>
      </div>
    );
  }

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
