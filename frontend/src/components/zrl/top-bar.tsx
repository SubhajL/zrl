import * as React from 'react';
import { Menu, Bell } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface TopBarProps {
  readonly title?: string;
  readonly actions?: React.ReactNode;
  readonly onMenuClick?: () => void;
  readonly className?: string;
}

export function TopBar({ title, actions, onMenuClick, className }: TopBarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/60 md:px-6',
        className,
      )}
    >
      {/* Left section */}
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
            aria-label="Toggle menu"
          >
            <Menu className="size-5" />
          </Button>
        )}
        <span className="text-lg font-bold tracking-tight lg:hidden">
          ZRL
        </span>
        {title && (
          <h1 className="hidden text-lg font-semibold md:block">{title}</h1>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right section */}
      <div className="flex items-center gap-2">
        {actions}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
        </Button>
        {/* User avatar placeholder */}
        <div
          className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary"
          aria-label="User menu"
          role="button"
          tabIndex={0}
        >
          <span aria-hidden="true">U</span>
        </div>
      </div>
    </header>
  );
}
