'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  BarChart3,
  Settings,
  ListChecks,
  Users,
} from 'lucide-react';
import { Sidebar, type NavItem } from '@/components/zrl/sidebar';
import { TopBar } from '@/components/zrl/top-bar';

const ICON_MAP: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="size-5" />,
  Package: <Package className="size-5" />,
  BarChart3: <BarChart3 className="size-5" />,
  Settings: <Settings className="size-5" />,
  ListChecks: <ListChecks className="size-5" />,
  Users: <Users className="size-5" />,
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: ICON_MAP.LayoutDashboard },
  { label: 'Lanes', href: '/lanes', icon: ICON_MAP.Package },
  { label: 'Analytics', href: '/analytics', icon: ICON_MAP.BarChart3 },
  { label: 'Rules Engine', href: '/admin/rules', icon: ICON_MAP.ListChecks },
  { label: 'Partner Portal', href: '/partner', icon: ICON_MAP.Users },
  { label: 'Settings', href: '/settings', icon: ICON_MAP.Settings },
];

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className="flex min-h-full">
      <Sidebar
        items={NAV_ITEMS}
        activeHref={pathname}
        mobileOpen={sidebarOpen}
        onMobileOpenChange={setSidebarOpen}
      />
      <div className="flex flex-1 flex-col lg:pl-64">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
