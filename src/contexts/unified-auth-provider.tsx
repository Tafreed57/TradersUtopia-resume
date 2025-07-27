'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { useUser } from '@clerk/nextjs';

// ✅ SIMPLIFIED: Basic authentication state only
interface UnifiedAuthState {
  // Authentication
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Profile
  profile: {
    id: string;
    email: string;
    name: string;
    createdAt: Date;
  } | null;

  // Actions
  refetch: () => Promise<void>;
}

// ✅ SIMPLIFIED: Single context for authentication needs
const UnifiedAuthContext = createContext<UnifiedAuthState | null>(null);

interface UnifiedAuthProviderProps {
  children: React.ReactNode;
}

export function UnifiedAuthProvider({ children }: UnifiedAuthProviderProps) {
  const { isLoaded, isSignedIn, user } = useUser();

  // Prevent multiple simultaneous fetches
  const isFetchingRef = useRef(false);

  // ✅ SIMPLIFIED: Single state for auth data only
  const [authState, setAuthState] = useState<UnifiedAuthState>({
    isAuthenticated: false,
    isLoading: true,
    error: null,
    profile: null,
    refetch: async () => {},
  });

  // ✅ SIMPLIFIED: Fetch basic auth data without subscription checking
  const fetchUnifiedAuthData = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !user || isFetchingRef.current) {
      if (!isLoaded || !isSignedIn || !user) {
        setAuthState(prev => ({
          ...prev,
          isAuthenticated: false,
          isLoading: false,
          profile: null,
          error: null,
        }));
      }
      return;
    }

    // Prevent multiple simultaneous fetches
    isFetchingRef.current = true;
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      console.log(
        `🚀 [UNIFIED-AUTH] Setting up authentication for user: ${user.id}`
      );

      // ✅ SIMPLIFIED: Just set the auth state from Clerk user data
      const newAuthState: Partial<UnifiedAuthState> = {
        isAuthenticated: true,
        isLoading: false,
        profile: {
          id: user.id,
          email: user.primaryEmailAddress?.emailAddress || '',
          name: user.fullName || `${user.firstName} ${user.lastName}`,
          createdAt: new Date(user.createdAt || new Date()),
        },
        error: null,
      };

      setAuthState(prev => ({ ...prev, ...newAuthState }));

      console.log(
        `✅ [UNIFIED-AUTH] Successfully loaded auth data for user: ${user.id}`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Authentication failed';
      console.error('❌ [UNIFIED-AUTH] Failed to set auth data:', error);

      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    } finally {
      // Always release the fetch lock
      isFetchingRef.current = false;
    }
  }, [isLoaded, isSignedIn, user]);

  // ✅ SIMPLIFIED: Load auth data when user is available
  useEffect(() => {
    if (isLoaded) {
      if (!isSignedIn || !user) {
        // Clear auth state for signed out users
        setAuthState(prev => ({
          ...prev,
          isAuthenticated: false,
          isLoading: false,
          profile: null,
          error: null,
        }));
      } else {
        // Set auth data for signed in users
        fetchUnifiedAuthData();
      }
    }
  }, [isLoaded, isSignedIn, user, fetchUnifiedAuthData]);

  // ✅ FINALIZED: Complete auth state with actions
  const finalAuthState: UnifiedAuthState = {
    ...authState,
    refetch: fetchUnifiedAuthData,
  };

  return (
    <UnifiedAuthContext.Provider value={finalAuthState}>
      {children}
    </UnifiedAuthContext.Provider>
  );
}

// ✅ HOOK: Easy access to unified auth state
export function useUnifiedAuth(): UnifiedAuthState {
  const context = useContext(UnifiedAuthContext);
  if (!context) {
    throw new Error('useUnifiedAuth must be used within UnifiedAuthProvider');
  }
  return context;
}
