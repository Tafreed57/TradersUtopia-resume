'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from 'react';
import { useRouter } from 'next/navigation';
import { ServerWithMembersWithUsers } from '@/types/server';
import { useExtendedUser } from '@/contexts/session-provider';

interface ServerDataState {
  server: ServerWithMembersWithUsers | null;
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;
}

interface ServerDataContextType extends ServerDataState {
  refetch: () => Promise<void>;
  clearCache: () => void;
  prefetchChannel: (channelId: string) => Promise<void>;
}

const ServerDataContext = createContext<ServerDataContextType | null>(null);

interface ServerDataProviderProps {
  children: React.ReactNode;
  serverId: string;
  cacheTimeout?: number; // in milliseconds, default 2 minutes
}

// Global cache for server data to prevent duplicate requests
const serverCache = new Map<
  string,
  {
    data: ServerWithMembersWithUsers;
    timestamp: number;
  }
>();

const pendingServerRequests = new Map<
  string,
  Promise<ServerWithMembersWithUsers>
>();

export function ServerDataProvider({
  children,
  serverId,
  cacheTimeout = 2 * 60 * 1000, // 2 minutes default
}: ServerDataProviderProps) {
  const router = useRouter();
  const {
    isLoaded,
    user,
    hasAccess,
    isAdmin,
    isLoading: sessionLoading,
  } = useExtendedUser();
  const [serverState, setServerState] = useState<ServerDataState>({
    server: null,
    isLoading: true,
    error: null,
    lastFetch: null,
  });

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchServerData = useCallback(
    async (forceRefresh = false): Promise<void> => {
      if (!isLoaded || sessionLoading) return;

      // Redirect if not authenticated
      if (!user) {
        router.push('/sign-in');
        return;
      }

      // Redirect if no access and not admin
      if (!hasAccess && !isAdmin) {
        router.push('/pricing');
        return;
      }

      const now = Date.now();

      // Check global cache first
      const cached = serverCache.get(serverId);
      if (!forceRefresh && cached && now - cached.timestamp < cacheTimeout) {
        if (isMountedRef.current) {
          setServerState({
            server: cached.data,
            isLoading: false,
            error: null,
            lastFetch: cached.timestamp,
          });
        }
        return;
      }

      // Check for pending request to avoid duplicates
      if (pendingServerRequests.has(serverId)) {
        try {
          const result = await pendingServerRequests.get(serverId)!;
          if (isMountedRef.current) {
            setServerState({
              server: result,
              isLoading: false,
              error: null,
              lastFetch: now,
            });
          }

          // Update global cache
          serverCache.set(serverId, {
            data: result,
            timestamp: now,
          });
        } catch (error) {
          if (isMountedRef.current) {
            setServerState(prev => ({
              ...prev,
              isLoading: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            }));
          }
        }
        return;
      }

      // Set loading state
      if (isMountedRef.current) {
        setServerState(prev => ({ ...prev, isLoading: true, error: null }));
      }

      // Create new request promise
      const requestPromise = fetch(`/api/servers/${serverId}`, {
        headers: {
          'Cache-Control': 'no-cache',
        },
      }).then(async response => {
        if (!response.ok) {
          if (response.status === 404) {
            router.push('/');
            throw new Error('Server not found');
          }
          throw new Error(`Failed to fetch server: ${response.status}`);
        }

        return response.json();
      });

      // Store the promise to prevent duplicates
      pendingServerRequests.set(serverId, requestPromise);

      try {
        const result = await requestPromise;

        if (isMountedRef.current) {
          setServerState({
            server: result,
            isLoading: false,
            error: null,
            lastFetch: now,
          });
        }

        // Update global cache
        serverCache.set(serverId, {
          data: result,
          timestamp: now,
        });
      } catch (error) {
        console.error('Server fetch error:', error);

        if (isMountedRef.current) {
          setServerState(prev => ({
            ...prev,
            server: null,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            lastFetch: now,
          }));
        }

        // If server not found, redirect to home
        if (error instanceof Error && error.message.includes('not found')) {
          router.push('/');
        }
      } finally {
        // Clean up the pending request
        pendingServerRequests.delete(serverId);
      }
    },
    [isLoaded, sessionLoading, user, hasAccess, isAdmin, serverId, router]
  );

  const prefetchChannel = async (channelId: string): Promise<void> => {
    try {
      // Prefetch channel-specific data if needed
      await fetch(`/api/servers/${serverId}/channels/${channelId}`, {
        method: 'HEAD', // Just check if accessible, don't fetch full data
      });
    } catch (error) {
      console.warn('Channel prefetch failed:', error);
    }
  };

  const clearCache = () => {
    serverCache.delete(serverId);
    setServerState(prev => ({
      ...prev,
      lastFetch: null,
    }));
  };

  const refetch = () => fetchServerData(true);

  // Initial fetch and refetch on dependencies
  useEffect(() => {
    fetchServerData();
  }, [
    isLoaded,
    user,
    hasAccess,
    isAdmin,
    sessionLoading,
    serverId,
    fetchServerData,
  ]);

  // Auto-refresh expired cache in background
  useEffect(() => {
    if (!serverState.lastFetch || !serverState.server) return;

    const timeUntilExpiry = cacheTimeout - (Date.now() - serverState.lastFetch);
    if (timeUntilExpiry <= 0) return;

    const refreshTimer = setTimeout(() => {
      fetchServerData(true);
    }, timeUntilExpiry);

    return () => clearTimeout(refreshTimer);
  }, [
    serverState.lastFetch,
    serverState.server,
    cacheTimeout,
    fetchServerData,
  ]);

  const contextValue: ServerDataContextType = {
    ...serverState,
    refetch,
    clearCache,
    prefetchChannel,
  };

  return (
    <ServerDataContext.Provider value={contextValue}>
      {children}
    </ServerDataContext.Provider>
  );
}

export function useServerData(): ServerDataContextType {
  const context = useContext(ServerDataContext);
  if (!context) {
    throw new Error('useServerData must be used within a ServerDataProvider');
  }
  return context;
}

// Helper hook to get current user's member data from server
export function useCurrentMember() {
  const { server } = useServerData();
  const { user } = useExtendedUser();

  if (!server || !user) return null;

  return server.members?.[0] || null; // Current user's member data
}
