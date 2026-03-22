import { ReactNode } from 'react';
import { requireAdminSession } from '../../lib/auth/require-admin';

interface AdminLayoutProps {
  children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  await requireAdminSession();
  return <>{children}</>;
}
