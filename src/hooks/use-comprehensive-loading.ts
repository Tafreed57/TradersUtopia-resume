'use client';

import { useState, useCallback } from 'react';
import { useLoading } from '@/contexts/loading-provider';

interface LoadingState {
  isLoading: boolean;
  message: string;
  progress?: number;
}

interface LoadingActions {
  startLoading: (message?: string) => void;
  stopLoading: () => void;
  updateProgress: (progress: number) => void;
  updateMessage: (message: string) => void;
}

type LoadingType =
  | 'global' // Full screen loading
  | 'component' // Component-level loading
  | 'button' // Button loading state
  | 'api' // API call loading
  | 'navigation' // Route navigation loading
  | 'form' // Form submission loading
  | 'upload'; // File upload loading

export function useComprehensiveLoading(type: LoadingType = 'component') {
  const globalLoading = useLoading();

  // Local loading state for component-level loading
  const [localLoading, setLocalLoading] = useState<LoadingState>({
    isLoading: false,
    message: 'Loading...',
    progress: 0,
  });

  const getDefaultMessage = useCallback((type: LoadingType): string => {
    switch (type) {
      case 'global':
        return 'Loading your trading platform...';
      case 'component':
        return 'Loading...';
      case 'button':
        return 'Processing...';
      case 'api':
        return 'Fetching data...';
      case 'navigation':
        return 'Navigating...';
      case 'form':
        return 'Submitting...';
      case 'upload':
        return 'Uploading...';
      default:
        return 'Loading...';
    }
  }, []);

  const startLoading = useCallback(
    (message?: string) => {
      const loadingMessage = message || getDefaultMessage(type);

      if (type === 'global') {
        // ✅ IMMEDIATE FEEDBACK: Start global loading instantly
        globalLoading.startLoading(loadingMessage);
      } else {
        // ✅ IMMEDIATE FEEDBACK: Set local loading state immediately
        setLocalLoading({
          isLoading: true,
          message: loadingMessage,
          progress: 0,
        });
      }
    },
    [type, globalLoading, getDefaultMessage]
  );

  const stopLoading = useCallback(() => {
    if (type === 'global') {
      globalLoading.stopLoading();
    } else {
      setLocalLoading(prev => ({
        ...prev,
        isLoading: false,
        progress: 100,
      }));
    }
  }, [type, globalLoading]);

  const updateProgress = useCallback(
    (progress: number) => {
      if (type !== 'global') {
        setLocalLoading(prev => ({
          ...prev,
          progress: Math.min(Math.max(progress, 0), 100),
        }));
      }
    },
    [type]
  );

  const updateMessage = useCallback(
    (message: string) => {
      if (type === 'global') {
        globalLoading.startLoading(message);
      } else {
        setLocalLoading(prev => ({
          ...prev,
          message,
        }));
      }
    },
    [type, globalLoading]
  );

  // Wrapper for async operations with automatic loading
  const withLoading = useCallback(
    async <T>(
      operation: () => Promise<T>,
      options?: {
        loadingMessage?: string;
        successMessage?: string;
        errorMessage?: string;
        immediate?: boolean; // Force immediate loading
      }
    ): Promise<T> => {
      try {
        // ✅ IMMEDIATE FEEDBACK: Start loading immediately, before any async work
        startLoading(options?.loadingMessage);

        // Small delay to ensure UI updates before async operation
        if (options?.immediate !== false) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        const result = await operation();

        if (options?.successMessage) {
          updateMessage(options.successMessage);
          setTimeout(stopLoading, 1000); // Show success message briefly
        } else {
          stopLoading();
        }

        return result;
      } catch (error) {
        if (options?.errorMessage) {
          updateMessage(options.errorMessage);
          setTimeout(stopLoading, 2000); // Show error message longer
        } else {
          stopLoading();
        }
        throw error;
      }
    },
    [startLoading, stopLoading, updateMessage]
  );

  const currentState =
    type === 'global'
      ? {
          isLoading: globalLoading.isLoading,
          message: 'Loading...', // Global message is managed internally
          progress: undefined,
        }
      : localLoading;

  return {
    ...currentState,
    startLoading,
    stopLoading,
    updateProgress,
    updateMessage,
    withLoading,
    actions: {
      startLoading,
      stopLoading,
      updateProgress,
      updateMessage,
    } as LoadingActions,
  };
}
