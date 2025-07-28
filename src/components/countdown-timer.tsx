'use client';

import { useState, useEffect, useCallback } from 'react';

interface CountdownTimerProps {
  className?: string;
}

interface TimerSettings {
  startTime: number;
  duration: number;
  message: string;
  priceMessage: string;
  remainingHours: number;
  isExpired: boolean;
}

export function CountdownTimer({ className = '' }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState<TimerSettings | null>(null);

  // Fetch timer settings from API
  const fetchTimerSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/timer', {
        method: 'GET',
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch timer settings: ${response.status}`);
      }
      const data = await response.json();

      if (data.success && data.timer) {
        setTimer(data.timer);

        // Convert remaining hours to hours, minutes, seconds
        const totalSeconds = Math.floor(data.timer.remainingHours * 3600);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        setTimeLeft({ hours, minutes, seconds });
        setError(null);
      } else {
        throw new Error('Invalid timer settings response');
      }
    } catch (error) {
      console.error('Error fetching timer settings:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');

      // Fallback values
      setTimeLeft({ hours: 72, minutes: 0, seconds: 0 });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize timer on mount
  useEffect(() => {
    fetchTimerSettings();
  }, [fetchTimerSettings]);

  // Timer countdown logic
  useEffect(() => {
    if (isLoading || error) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        const { hours, minutes, seconds } = prev;

        // If timer reaches zero, refetch settings (auto-reset)
        if (hours === 0 && minutes === 0 && seconds === 0) {
          fetchTimerSettings();
          return prev;
        }

        // Normal countdown logic
        if (seconds > 0) {
          return { ...prev, seconds: seconds - 1 };
        } else if (minutes > 0) {
          return { hours, minutes: minutes - 1, seconds: 59 };
        } else if (hours > 0) {
          return { hours: hours - 1, minutes: 59, seconds: 59 };
        }

        // Shouldn't reach here, but safety fallback
        return { hours: 0, minutes: 0, seconds: 0 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isLoading, error, fetchTimerSettings]);

  // Refetch timer settings every 5 minutes to stay in sync
  useEffect(() => {
    const syncTimer = setInterval(
      () => {
        if (!isLoading) {
          fetchTimerSettings();
        }
      },
      5 * 60 * 1000
    ); // 5 minutes

    return () => clearInterval(syncTimer);
  }, [isLoading, fetchTimerSettings]);

  // Listen for timer settings updates from admin modal
  useEffect(() => {
    const handleTimerUpdate = () => {
      fetchTimerSettings();
    };

    window.addEventListener('timerSettingsUpdated', handleTimerUpdate);
    return () =>
      window.removeEventListener('timerSettingsUpdated', handleTimerUpdate);
  }, [fetchTimerSettings]);

  const formatTime = (hours: number, minutes: number, seconds: number) => {
    const hh = hours.toString().padStart(2, '0');
    const mm = minutes.toString().padStart(2, '0');
    const ss = seconds.toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  if (isLoading) {
    return (
      <div
        className={`text-sm sm:text-lg md:text-xl font-bold text-white font-mono ${className}`}
      >
        --:--:--
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`text-sm sm:text-lg md:text-xl font-bold text-red-400 font-mono ${className}`}
      >
        Error
      </div>
    );
  }

  return (
    <div
      className={`text-sm sm:text-lg md:text-xl font-bold text-white font-mono ${className}`}
    >
      {formatTime(timeLeft.hours, timeLeft.minutes, timeLeft.seconds)}
    </div>
  );
}
