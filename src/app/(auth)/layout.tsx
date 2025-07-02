import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Traders Utopia - Authentication',
  description: 'Access your professional trading community and signals.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
