"use client";

import { useEffect, useState } from 'react';
import { showToast } from '@/lib/notifications';

export function AutoJoinDefault() {
  const [hasJoined, setHasJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user has already joined from localStorage
    const hasJoinedBefore = localStorage.getItem('hasJoinedDefaultServer');
    if (hasJoinedBefore === 'true') {
      setHasJoined(true);
      setIsLoading(false);
      return;
    }

    const joinDefaultServer = async () => {
      try {
        const response = await fetch('/api/servers/ensure-default', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();

        if (response.ok) {
          console.log('✅ Auto-joined to default server:', data.message);
          setHasJoined(true);
          
          // Store in localStorage to prevent future calls
          localStorage.setItem('hasJoinedDefaultServer', 'true');
          
          // No router.refresh() - let the server list update naturally
        } else {
          console.error('❌ Failed to join default server:', data.error);
        }
      } catch (error) {
        console.error('Error joining default server:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (!hasJoined) {
      joinDefaultServer();
    }
  }, []); // Remove hasJoined and router from dependencies to prevent re-runs

  // This component doesn't render anything visible
  return null;
} 