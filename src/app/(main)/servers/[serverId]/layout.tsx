'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ServerSideBar } from '@/components/layout/server-side-bar';
import { MainContent } from '@/components/layout/main-content';
import { useExtendedUser } from '@/hooks/use-extended-user';
import { ServerWithMembersWithUsers } from '@/types/server';

const ServerIdLayout = ({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { serverId: string };
}) => {
  const router = useRouter();
  const { isLoaded, user, hasAccess, isAdmin, isLoading } = useExtendedUser();
  const [server, setServer] = useState<ServerWithMembersWithUsers | null>(null);
  const [serverLoading, setServerLoading] = useState(true);

  // Fetch server data from API
  useEffect(() => {
    const fetchServer = async () => {
      if (!isLoaded || !user) return;

      try {
        const response = await fetch(`/api/servers/${params.serverId}`);
        if (response.ok) {
          const serverData = await response.json();
          setServer(serverData);
        } else {
          router.push('/');
        }
      } catch (error) {
        console.error('Error fetching server:', error);
        router.push('/');
      } finally {
        setServerLoading(false);
      }
    };

    fetchServer();
  }, [isLoaded, user, params.serverId, router]);

  // Handle authentication and access control
  useEffect(() => {
    if (!isLoaded || isLoading) return;

    // Redirect to sign-in if not authenticated
    if (!user) {
      router.push('/sign-in');
      return;
    }

    // Redirect to pricing if signed in but no access (and not admin)
    if (!hasAccess && !isAdmin) {
      router.push('/pricing');
      return;
    }
  }, [isLoaded, user, hasAccess, isAdmin, isLoading, router]);

  // Show loading state while checking auth or fetching server
  if (!isLoaded || isLoading || serverLoading) {
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

  // Don't render if server data isn't loaded
  if (!server) {
    return null;
  }

  return (
    <div className='h-full'>
      <div className='hidden md:flex h-full z-20 flex-col fixed inset-y-0'>
        <ServerSideBar serverId={params.serverId} />
      </div>
      <MainContent id='main-content'>{children}</MainContent>
    </div>
  );
};

export default ServerIdLayout;
