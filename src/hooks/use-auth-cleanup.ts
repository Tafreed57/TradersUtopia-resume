import { useUser } from '@clerk/nextjs';
import { useEffect, useRef } from 'react';

export function useAuthCleanup() {
  const { isSignedIn } = useUser();
  const wasSignedIn = useRef(false);

  useEffect(() => {
    // If user was signed in but now isn't, they've signed out
    if (wasSignedIn.current && !isSignedIn) {
      console.log('🧹 [Auth] User signed out, cleaning up auth state...');
      
      // Clear 2FA verification cookie with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      fetch('/api/auth/signout', {
        method: 'POST',
        signal: controller.signal,
      })
      .then(() => {
        console.log('✅ [Auth] Auth state cleared successfully');
      })
      .catch(error => {
        if (error.name === 'AbortError') {
          console.warn('⏰ [Auth] Auth cleanup timed out');
        } else {
          console.error('❌ [Auth] Failed to clear auth state:', error);
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
      });
    }
    
    wasSignedIn.current = isSignedIn ?? false;
  }, [isSignedIn]);
} 