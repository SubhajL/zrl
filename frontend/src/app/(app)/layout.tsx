import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/zrl/app-shell';
import {
  AUTH_ACCESS_COOKIE,
  AUTH_REFRESH_COOKIE,
} from '@/lib/auth-session';

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  if (
    cookieStore.get(AUTH_ACCESS_COOKIE)?.value === undefined &&
    cookieStore.get(AUTH_REFRESH_COOKIE)?.value === undefined
  ) {
    redirect('/login');
  }

  return <AppShell>{children}</AppShell>;
}
