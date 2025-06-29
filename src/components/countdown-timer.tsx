"use client";

import { useState, useEffect } from "react";

interface CountdownTimerProps {
  initialMinutes?: number;
  initialSeconds?: number;
}

export function CountdownTimer({
  initialMinutes = 4,
  initialSeconds = 18,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState({
    minutes: initialMinutes,
    seconds: initialSeconds,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.minutes === 0 && prev.seconds === 0) {
          // Reset timer when it reaches 0
          return { minutes: initialMinutes, seconds: initialSeconds };
        }

        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else {
          return { minutes: Math.max(0, prev.minutes - 1), seconds: 59 };
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [initialMinutes, initialSeconds]);

  const formatTime = (minutes: number, seconds: number) => {
    const mm = minutes.toString().padStart(2, "0");
    const ss = seconds.toString().padStart(2, "0");
    return `${mm}:${ss}`;
  };

  return (
    <div className="text-4xl md:text-6xl font-bold text-white font-mono bg-gradient-to-r from-red-600/20 to-orange-600/20 rounded-lg px-6 py-3 border border-red-400/30">
      {formatTime(timeLeft.minutes, timeLeft.seconds)}
    </div>
  );
}
