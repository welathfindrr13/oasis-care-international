import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from './auth-options';
import { hasRole } from './roles';

export async function requireAdminSession() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  if (!hasRole((session as any).roles, 'admin')) {
    redirect('/activity?unauthorized=1');
  }

  return session;
}
