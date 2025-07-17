import { RedirectToSignIn } from '@clerk/nextjs';
import { redirect } from 'next/navigation';

import { ServerHeader } from '@/components/layout/server-header';
import { ServerSideBar } from '@/components/layout/server-side-bar';
import { ProductPaymentGate } from '@/components/product-payment-gate';
import { getCurrentProfileWithSync, getServer } from '@/lib/query';
import { TRADING_ALERT_PRODUCTS } from '@/lib/product-config';

const ServerIdLayout = async ({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { serverId: string };
}) => {
  const profile = await getCurrentProfileWithSync();

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
        <div className='hidden md:flex h-full w-60 z-20 flex-col fixed inset-y-0'>
          <ServerSideBar serverId={params.serverId} />
        </div>
        <main className='h-full md:pl-60'>
          <ServerHeader server={server} />
          {children}
        </main>
      </div>
    </ProductPaymentGate>
  );
};

export default ServerIdLayout;
