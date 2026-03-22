'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly icon: React.ReactNode;
  readonly badge?: string;
}

export interface SidebarProps {
  readonly items: readonly NavItem[];
  readonly activeHref?: string;
  readonly className?: string;
  readonly mobileOpen?: boolean;
  readonly onMobileOpenChange?: (open: boolean) => void;
}

function NavLink({
  item,
  isActive,
}: {
  readonly item: NavItem;
  readonly isActive: boolean;
}) {
  return (
    <a
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        isActive
          ? 'bg-primary/10 font-semibold text-primary'
          : 'text-muted-foreground hover:bg-accent',
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      <span className="shrink-0" aria-hidden="true">
        {item.icon}
      </span>
      <span className="flex-1">{item.label}</span>
      {item.badge && (
        <Badge variant="secondary" className="ml-auto text-xs">
          {item.badge}
        </Badge>
      )}
    </a>
  );
}

function NavList({
  items,
  activeHref,
}: {
  readonly items: readonly NavItem[];
  readonly activeHref?: string;
}) {
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-1">
      {items.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          isActive={activeHref === item.href}
        />
      ))}
    </nav>
  );
}

export function Sidebar({
  items,
  activeHref,
  className,
  mobileOpen: controlledOpen,
  onMobileOpenChange: controlledOnChange,
}: SidebarProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = controlledOpen ?? internalOpen;
  const setIsOpen = controlledOnChange ?? setInternalOpen;

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:z-30 lg:border-r lg:bg-card',
          className,
        )}
      >
        {/* Logo area */}
        <div className="flex h-16 items-center border-b px-6">
          <span className="text-xl font-bold tracking-tight">ZRL</span>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <NavList items={items} activeHref={activeHref} />
        </div>
      </aside>

      {/* Mobile sidebar sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle className="text-xl font-bold tracking-tight">
              ZRL
            </SheetTitle>
          </SheetHeader>
          <div className="px-4 py-4">
            <NavList items={items} activeHref={activeHref} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
