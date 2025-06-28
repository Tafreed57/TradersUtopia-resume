"use client";

import { useNavigation } from '@/hooks/use-navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ReactNode } from 'react';

interface NavigationButtonProps {
  href: string;
  children: ReactNode;
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  loadingMessage?: string;
  asButton?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function NavigationButton({ 
  href, 
  children, 
  className = "", 
  variant,
  size,
  loadingMessage,
  asButton = false,
  disabled = false,
  onClick
}: NavigationButtonProps) {
  const { navigateTo } = useNavigation();

  const handleClick = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
    }
    if (onClick) {
      onClick();
    }
    navigateTo(href, loadingMessage);
  };

  if (asButton) {
    return (
      <Button
        onClick={handleClick}
        className={className}
        variant={variant}
        size={size}
        disabled={disabled}
      >
        {children}
      </Button>
    );
  }

  // For link-style navigation
  return (
    <Link href={href} onClick={handleClick} className={className}>
      {children}
    </Link>
  );
} 