import { ReactNode } from 'react';
import { requireAdminSession } from '../../lib/auth/require-admin';

interface ClientsLayoutProps {
  children: ReactNode;
}

export default async function ClientsLayout({ children }: ClientsLayoutProps) {
  await requireAdminSession();
  return <>{children}</>;
}
