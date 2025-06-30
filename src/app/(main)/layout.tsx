import { SideBar } from '@/components/layout/side-bar';
import { ServerHeader } from '@/components/layout/server-header';
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
    <section className='h-full bg-white dark:bg-[#313338]'>
      {/* Desktop Sidebar - Hidden on mobile */}
      <div className='hidden md:flex w-[72px] z-30 flex-col fixed inset-y-0'>
        {await SideBar()}
      </div>

      {/* Main Content Area */}
      <main className='h-full md:pl-[72px] bg-white dark:bg-[#313338] transition-colors duration-200'>
        <div className='h-full w-full'>{children}</div>
      </main>
    </section>
  );
}
