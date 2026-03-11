import { ReactNode } from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '../api/auth/[...nextauth]/route';
import { hasRole } from '../../lib/auth/roles';

interface AdminLayoutProps {
  children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await getServerSession(authOptions);

  if (!session || !hasRole((session as any).roles, 'admin')) {
    redirect('/activity');
  }

  return <>{children}</>;
}
