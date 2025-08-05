'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from 'react';
import { useUser } from '@clerk/nextjs';

interface SessionData {
  hasAccess: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  profile: any;
}

interface SessionState extends SessionData {
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;
}

interface SessionContextType extends SessionState {
  refetch: () => Promise<void>;
  clearCache: () => void;
}

const SessionContext = createContext<SessionContextType | null>(null);

interface SessionProviderProps {
  children: React.ReactNode;
  cacheTimeout?: number; // in milliseconds, default 5 minutes
}

// Global state to prevent duplicate requests
const pendingRequests = new Map<string, Promise<SessionData>>();

export function SessionProvider({
  children,
  cacheTimeout = 5 * 60 * 1000, // 5 minutes default
}: SessionProviderProps) {
  const { isLoaded, isSignedIn, user } = useUser();
  const [sessionState, setSessionState] = useState<SessionState>({
    hasAccess: false,
    isAdmin: false,
    isAuthenticated: false,
    profile: null,
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

  const fetchSessionData = useCallback(
    async (forceRefresh = false): Promise<void> => {
      if (!isLoaded) return;

      // If not signed in, set authenticated state to false
      if (!isSignedIn) {
        if (isMountedRef.current) {
          setSessionState({
            hasAccess: false,
            isAdmin: false,
            isAuthenticated: false,
            profile: null,
            isLoading: false,
            error: null,
            lastFetch: Date.now(),
          });
        }
        return;
      }

      const userId = user?.id;
      if (!userId) return;

      // Check cache validity
      const now = Date.now();
      if (
        !forceRefresh &&
        sessionState.lastFetch &&
        now - sessionState.lastFetch < cacheTimeout &&
        sessionState.isAuthenticated
      ) {
        // Cache is still valid, just ensure loading is false
        if (sessionState.isLoading && isMountedRef.current) {
          setSessionState(prev => ({ ...prev, isLoading: false }));
        }
        return;
      }

      // Check for pending request to avoid duplicates
      const requestKey = `session-${userId}`;
      if (pendingRequests.has(requestKey)) {
        try {
          const cachedResult = await pendingRequests.get(requestKey)!;
          if (isMountedRef.current) {
            setSessionState({
              ...cachedResult,
              isLoading: false,
              error: null,
              lastFetch: now,
            });
          }
        } catch (error) {
          if (isMountedRef.current) {
            setSessionState(prev => ({
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
        setSessionState(prev => ({ ...prev, isLoading: true, error: null }));
      }

      // Create new request promise
      const requestPromise = fetch('/api/auth/session-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(async response => {
        if (!response.ok) {
          throw new Error(`Session check failed: ${response.status}`);
        }

        const data = await response.json();
        return {
          hasAccess: data.hasAccess || false,
          isAdmin: data.isAdmin || false,
          isAuthenticated: data.isAuthenticated || false,
          profile: data.profile || null,
        };
      });

      // Store the promise to prevent duplicates
      pendingRequests.set(requestKey, requestPromise);

      try {
        const result = await requestPromise;

        if (isMountedRef.current) {
          setSessionState({
            ...result,
            isLoading: false,
            error: null,
            lastFetch: now,
          });
        }
      } catch (error) {
        console.error('Session check error:', error);

        if (isMountedRef.current) {
          setSessionState(prev => ({
            ...prev,
            hasAccess: false,
            isAdmin: false,
            isAuthenticated: false,
            profile: null,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            lastFetch: now,
          }));
        }
      } finally {
        // Clean up the pending request
        pendingRequests.delete(requestKey);
      }
    },
    [
      isLoaded,
      isSignedIn,
      user?.id,
      sessionState.lastFetch,
      sessionState.isAuthenticated,
      sessionState.isLoading,
      cacheTimeout,
    ]
  );

  const clearCache = () => {
    setSessionState(prev => ({
      ...prev,
      lastFetch: null,
    }));
  };

  const refetch = () => fetchSessionData(true);

  // Initial fetch and refetch on user changes
  useEffect(() => {
    fetchSessionData();
  }, [isLoaded, isSignedIn, user?.id, fetchSessionData]);

  // Auto-refresh expired cache in background
  useEffect(() => {
    if (!sessionState.lastFetch || !sessionState.isAuthenticated) return;

    const timeUntilExpiry =
      cacheTimeout - (Date.now() - sessionState.lastFetch);
    if (timeUntilExpiry <= 0) return;

    const refreshTimer = setTimeout(() => {
      fetchSessionData(true);
    }, timeUntilExpiry);

    return () => clearTimeout(refreshTimer);
  }, [
    sessionState.lastFetch,
    sessionState.isAuthenticated,
    cacheTimeout,
    fetchSessionData,
  ]);

  const contextValue: SessionContextType = {
    ...sessionState,
    refetch,
    clearCache,
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextType {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}

// Backward compatibility hook that mimics the old useExtendedUser interface
export function useExtendedUser() {
  const { isLoaded, isSignedIn, user } = useUser();
  const session = useSession();

  return {
    // Clerk passthrough
    isLoaded,
    isSignedIn: isSignedIn || false,
    user,

    // Session data
    hasAccess: session.hasAccess,
    isAdmin: session.isAdmin,
    isLoading: session.isLoading,
    error: session.error,

    // Additional methods
    refetch: session.refetch,
    clearCache: session.clearCache,
  };
}
