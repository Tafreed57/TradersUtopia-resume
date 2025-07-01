"use client";

import { useAuthCleanup } from "@/hooks/use-auth-cleanup";

interface AuthWrapperProps {
  children: React.ReactNode;
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  useAuthCleanup();

  return <>{children}</>;
}
