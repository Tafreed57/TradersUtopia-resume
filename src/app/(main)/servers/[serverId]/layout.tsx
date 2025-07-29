import { RedirectToSignIn } from '@clerk/nextjs';
import { redirect } from 'next/navigation';

import { ServerHeader } from '@/components/layout/server-header';
import { ServerSideBar } from '@/components/layout/server-side-bar';
import { MainContent } from '@/components/layout/main-content';
import { ProductPaymentGate } from '@/components/product-payment-gate';
import { getCurrentProfileForAuth, getServer } from '@/lib/query';
import { TRADING_ALERT_PRODUCTS } from '@/lib/product-config';
import { ServerWithMembersWithUsers } from '@/types/server';

const ServerIdLayout = async ({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { serverId: string };
}) => {
  const profile = await getCurrentProfileForAuth();

  if (!profile) {
    return <RedirectToSignIn />;
  }

  // Get the server data
  const server = await getServer(params.serverId, profile.id);

  if (!server) {
    return redirect('/');
  }

  // ✅ UPDATED: Use client-safe product IDs for server access
  const allowedProductIds = [...TRADING_ALERT_PRODUCTS]; // Convert readonly to mutable array

  return (
    <ProductPaymentGate allowedProductIds={allowedProductIds}>
      <div className='h-full'>
        <div className='hidden md:flex h-full z-20 flex-col fixed inset-y-0'>
          <ServerSideBar serverId={params.serverId} />
        </div>
        <MainContent id='main-content'>
          <ServerHeader server={server as ServerWithMembersWithUsers} />
          {children}
        </MainContent>
      </div>
    </ProductPaymentGate>
  );
};

export default ServerIdLayout;
