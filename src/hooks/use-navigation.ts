'use client';

import { useRouter } from 'next/navigation';
import { useLoading } from '@/contexts/loading-provider';

export function useNavigation() {
  const router = useRouter();
  const { startLoading } = useLoading();

  const navigateTo = (path: string, message?: string) => {
    const loadingMessage = message || getLoadingMessageForPath(path);
    startLoading(loadingMessage);
    router.push(path);
  };

  const navigateToExternal = (url: string) => {
    window.open(url, '_blank');
  };

  return {
    navigateTo,
    navigateToExternal,
    router,
  };
}

function getLoadingMessageForPath(path: string): string {
  if (path.includes('/dashboard')) return 'Loading your dashboard...';
  if (path.includes('/servers')) return 'Accessing trading community...';
  if (path.includes('/pricing')) return 'Loading pricing information...';
  if (path.includes('/sign-in')) return 'Redirecting to sign in...';
  if (path.includes('/sign-up')) return 'Redirecting to sign up...';
  if (path.includes('/free-videos')) return 'Loading free course videos...';
  if (path.includes('/user-profile')) return 'Loading your profile...';
  if (path.includes('/subscription-status'))
    return 'Loading subscription status...';
  if (path.includes('/checkout')) return 'Loading checkout page...';
  if (path.includes('/2fa-verify')) return 'Loading 2FA verification...';
  if (path === '/') return 'Loading homepage...';
  return 'Loading...';
}
