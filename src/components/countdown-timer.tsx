'use client';

import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  initialMinutes?: number;
  initialSeconds?: number;
  initialHours?: number;
  resetAtHours?: number;
}

export function CountdownTimer({
  initialMinutes = 4,
  initialSeconds = 18,
  initialHours = 72,
  resetAtHours = 11,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState({
    hours: initialHours,
    minutes: initialMinutes,
    seconds: initialSeconds,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        // Check if we've reached the reset point (11 hours)
        if (
          prev.hours === resetAtHours &&
          prev.minutes === 0 &&
          prev.seconds === 0
        ) {
          // Reset timer to initial values (72 hours)
          return {
            hours: initialHours,
            minutes: initialMinutes,
            seconds: initialSeconds,
          };
        }

        // Normal countdown logic
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        } else {
          // Fallback reset if we somehow reach 0:00:00
          return {
            hours: initialHours,
            minutes: initialMinutes,
            seconds: initialSeconds,
          };
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [initialHours, initialMinutes, initialSeconds, resetAtHours]);

  const formatTime = (hours: number, minutes: number, seconds: number) => {
    const hh = hours.toString().padStart(2, '0');
    const mm = minutes.toString().padStart(2, '0');
    const ss = seconds.toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  return (
    <div className='text-sm sm:text-lg md:text-xl font-bold text-white font-mono'>
      {formatTime(timeLeft.hours, timeLeft.minutes, timeLeft.seconds)}
    </div>
  );
}
