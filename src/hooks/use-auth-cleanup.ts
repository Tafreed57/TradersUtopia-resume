import { useUser } from '@clerk/nextjs';
import { useEffect, useRef } from 'react';

export function useAuthCleanup() {
  const { isSignedIn } = useUser();
  const wasSignedIn = useRef(false);

  useEffect(() => {
    // If user was signed in but now isn't, they've signed out
    if (wasSignedIn.current && !isSignedIn) {
      // Clear 2FA verification cookie
      fetch('/api/auth/signout', {
        method: 'POST',
      }).catch(error => {
        console.error('Failed to clear auth state:', error);
      });
    }
    
    wasSignedIn.current = isSignedIn ?? false;
  }, [isSignedIn]);
} 