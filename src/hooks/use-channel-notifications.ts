import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';

interface ChannelNotificationPreference {
  enabled: boolean;
  channelId: string;
}

export function useChannelNotifications(channelId: string) {
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const { userId } = useAuth();

  // Track if a request is already in progress to prevent duplicates
  const isRequestInProgress = useRef<boolean>(false);
  const lastFetchedChannel = useRef<string>('');

  // Fetch current notification preference
  useEffect(() => {
    const fetchPreference = async () => {
      // Guard conditions to prevent unnecessary calls
      if (!userId || !channelId || isRequestInProgress.current) return;

      // Skip if we already fetched this channel
      if (lastFetchedChannel.current === channelId) return;

      try {
        isRequestInProgress.current = true;
        setIsInitialLoading(true);

        const response = await fetch(
          `/api/notifications/channels/${channelId}`
        );

        if (response.ok) {
          const data: ChannelNotificationPreference = await response.json();
          setIsEnabled(data.enabled);
          lastFetchedChannel.current = channelId;
        } else {
          console.error('Failed to fetch channel notification preference');
        }
      } catch (error) {
        console.error('Error fetching channel notification preference:', error);
      } finally {
        setIsInitialLoading(false);
        isRequestInProgress.current = false;
      }
    };

    // Add a small delay to ensure channel loading is complete
    const timeoutId = setTimeout(fetchPreference, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [userId, channelId]);

  // Toggle notification preference
  const toggleNotifications = async () => {
    if (!userId || !channelId) return;

    setIsLoading(true);
    const newEnabled = !isEnabled;

    try {
      const response = await fetch(`/api/notifications/channels/${channelId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: newEnabled }),
      });

      if (response.ok) {
        const data = await response.json();
        setIsEnabled(data.enabled);
        toast.success(data.message);
      } else {
        const errorData = await response.json();
        toast.error(
          errorData.message || 'Failed to update notification preference'
        );
      }
    } catch (error) {
      console.error('Error toggling channel notification preference:', error);
      toast.error('Failed to update notification preference');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isEnabled,
    isLoading,
    isInitialLoading,
    toggleNotifications,
  };
}
