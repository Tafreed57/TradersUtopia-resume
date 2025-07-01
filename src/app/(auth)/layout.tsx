import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Traders Utopia - Login',
  description: 'Access your professional trading community and signals.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className='flex min-h-screen justify-center items-center p-4 sm:p-6 bg-gradient-to-br from-slate-900 via-gray-900 to-black'>
      <div className='w-full max-w-md mx-auto'>{children}</div>
    </div>
  );
}
