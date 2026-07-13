import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in | Oasis Care',
  description: 'Sign in to the care workspace provided by your organisation.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
