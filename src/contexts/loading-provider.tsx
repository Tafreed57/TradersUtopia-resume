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

  // Auto-hide loading after maximum time to prevent infinite loading
  useEffect(() => {
    if (!isLoading) return;

    const maxLoadingTime = setTimeout(() => {
      console.log('⚠️ Loading timeout - automatically stopping loading');
      setIsLoading(false);
    }, 10000);

    return () => clearTimeout(maxLoadingTime);
  }, [isLoading]);

  // Listen for navigation completion to auto-stop loading
  useEffect(() => {
    if (!isLoading) return;

    // Auto-stop loading after reasonable time for navigation
    const navigationTimeout = setTimeout(() => {
      console.log('⚠️ Navigation timeout - automatically stopping loading');
      setIsLoading(false);
    }, 3000);

    return () => clearTimeout(navigationTimeout);
  }, [isLoading]);

  // Clear loading on page visibility change (e.g., when page is fully loaded)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isLoading) {
        // Give it a moment for the page to settle, then clear loading
        setTimeout(() => {
          setIsLoading(false);
        }, 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
