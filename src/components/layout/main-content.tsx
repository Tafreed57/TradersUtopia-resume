'use client';

import React, { useState, useEffect } from 'react';

interface MainContentProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export function MainContent({
  children,
  className = '',
  id,
}: MainContentProps) {
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isMobile, setIsMobile] = useState(false);

  // Handle responsive design
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listen for sidebar width changes
  useEffect(() => {
    const updateWidth = () => {
      const savedWidth = localStorage.getItem('server-sidebar-width');
      if (savedWidth) {
        const width = parseInt(savedWidth, 10);
        if (width >= 240 && width <= 600) {
          setSidebarWidth(width);
        }
      }
    };

    // Initial load
    updateWidth();

    // Listen for storage changes
    window.addEventListener('storage', updateWidth);

    // Custom event for same-tab updates
    window.addEventListener('sidebar-width-changed', updateWidth);

    return () => {
      window.removeEventListener('storage', updateWidth);
      window.removeEventListener('sidebar-width-changed', updateWidth);
    };
  }, []);

  return (
    <main
      className={`h-full transition-all duration-200 ${className}`}
      style={{
        marginLeft: isMobile ? '0px' : `${sidebarWidth}px`,
      }}
      id={id}
    >
      {children}
    </main>
  );
}
