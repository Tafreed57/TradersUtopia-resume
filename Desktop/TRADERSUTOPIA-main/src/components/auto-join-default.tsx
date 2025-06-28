"use client";

import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { makeSecureRequest } from '@/lib/csrf-client';

export function AutoJoinDefault() {
  const { user, isLoaded } = useUser();
  const [hasAttempted, setHasAttempted] = useState(false);

  useEffect(() => {
    const ensureDefaultServer = async () => {
      if (!isLoaded || !user || hasAttempted) return;

      try {
        setHasAttempted(true);
        
        const response = await makeSecureRequest('/api/servers/ensure-default', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('✅ Default server ensured:', data.server.name);
          console.log('🎯 User automatically joined to Traders Utopia server');
          
          // DO NOT redirect - just silently join the user
          // The user can navigate to the server manually when they want to
        } else {
          console.error('❌ Failed to ensure default server');
        }
      } catch (error) {
        console.error('❌ Error ensuring default server:', error);
      }
    };

    ensureDefaultServer();
  }, [user, isLoaded, hasAttempted]);

  return null;
} 