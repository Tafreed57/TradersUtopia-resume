import { useState, useCallback, useEffect } from 'react';

interface UseResizableSidebarOptions {
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  localStorageKey?: string;
}

export function useResizableSidebar({
  minWidth = 240,
  maxWidth = 600,
  defaultWidth = 320,
  localStorageKey = 'server-sidebar-width',
}: UseResizableSidebarOptions = {}) {
  const [width, setWidth] = useState<number>(defaultWidth);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  // Load saved width from localStorage on mount
  useEffect(() => {
    const savedWidth = localStorage.getItem(localStorageKey);
    if (savedWidth) {
      const parsedWidth = parseInt(savedWidth, 10);
      if (parsedWidth >= minWidth && parsedWidth <= maxWidth) {
        setWidth(parsedWidth);
      }
    }
  }, [minWidth, maxWidth, localStorageKey]);

  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = e.clientX;
      const clampedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);

      setWidth(clampedWidth);

      // Save to localStorage
      localStorage.setItem(localStorageKey, clampedWidth.toString());

      // Dispatch custom event for same-tab updates
      window.dispatchEvent(new CustomEvent('sidebar-width-changed'));
    },
    [isResizing, minWidth, maxWidth, localStorageKey]
  );

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', resize);
      document.addEventListener('mouseup', stopResizing);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', stopResizing);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, resize, stopResizing]);

  return {
    width,
    isResizing,
    startResizing,
    stopResizing,
    resize,
  };
}
