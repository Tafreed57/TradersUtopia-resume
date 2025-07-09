'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import { LoadingScreen } from '@/components/ui/loading-screen';

interface LoadingContextType {
  isLoading: boolean;
  setLoading: (loading: boolean, message?: string) => void;
  startLoading: (message?: string) => void;
  stopLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}

interface LoadingProviderProps {
  children: ReactNode;
}

export function LoadingProvider({ children }: LoadingProviderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('Loading...');

  // Memoize functions to prevent infinite loops
  const setLoading = useCallback((loading: boolean, message = 'Loading...') => {
    setIsLoading(loading);
    if (message) {
      setLoadingMessage(message);
    }
  }, []);

  const startLoading = useCallback((message = 'Loading...') => {
    setIsLoading(true);
    setLoadingMessage(message);
  }, []);

  const stopLoading = useCallback(() => {
    setIsLoading(false);
  }, []);

  // ✅ FIX: Single consolidated useEffect to prevent competing timers
  useEffect(() => {
    if (!isLoading) return;

    // Set up all timers in one place to prevent conflicts
    const maxLoadingTime = setTimeout(() => {
      // Loading timeout - automatically stopping loading
      setIsLoading(false);
    }, 10000);

    const navigationTimeout = setTimeout(() => {
      // Navigation timeout - automatically stopping loading
      setIsLoading(false);
    }, 3000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isLoading) {
        // Give it a moment for the page to settle, then clear loading
        setTimeout(() => {
          setIsLoading(false);
        }, 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(maxLoadingTime);
      clearTimeout(navigationTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLoading]);

  return (
    <LoadingContext.Provider
      value={{ isLoading, setLoading, startLoading, stopLoading }}
    >
      {children}
      <LoadingScreen isVisible={isLoading} message={loadingMessage} />
    </LoadingContext.Provider>
  );
}
