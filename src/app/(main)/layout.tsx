import { SideBar } from '@/components/layout/side-bar';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Traders Utopia',
  description: 'Professional Trading Signals & Expert Education Platform',
  openGraph: {
    type: 'website',
  },
};

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className='h-full bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 overflow-visible'>
      {/* Desktop Sidebar - Hidden on mobile */}
      <div className='hidden md:flex w-[96px] z-30 flex-col fixed inset-y-0 overflow-visible'>
        {await SideBar()}
      </div>

      {/* Main Content Area */}
      <main className='h-full md:pl-[96px] bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 transition-colors duration-200 overflow-visible'>
        <div className='h-full w-full overflow-visible'>{children}</div>
      </main>
    </section>
  );
}
