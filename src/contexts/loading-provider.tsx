"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { LoadingScreen } from "@/components/ui/loading-screen";

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
    throw new Error("useLoading must be used within a LoadingProvider");
  }
  return context;
}

interface LoadingProviderProps {
  children: ReactNode;
}

export function LoadingProvider({ children }: LoadingProviderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("Loading...");
  const pathname = usePathname();

  // Memoize functions to prevent infinite loops
  const setLoading = useCallback((loading: boolean, message = "Loading...") => {
    setIsLoading(loading);
    if (message) {
      setLoadingMessage(message);
    }
  }, []);

  const startLoading = useCallback(
    (message = "Loading...") => {
      setLoading(true, message);
    },
    [setLoading],
  );

  const stopLoading = useCallback(() => {
    setLoading(false);
  }, [setLoading]);

  // Auto-stop loading when pathname changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [pathname]);

  // Auto-hide loading after maximum time to prevent infinite loading
  useEffect(() => {
    if (!isLoading) return;

    const maxLoadingTime = setTimeout(() => {
      setIsLoading(false);
    }, 10000);

    return () => clearTimeout(maxLoadingTime);
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
