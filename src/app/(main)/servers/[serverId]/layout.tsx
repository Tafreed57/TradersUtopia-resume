import { ServerSideBar } from '@/components/layout/server-side-bar';
import { getCurrentProfile, getServer } from '@/lib/query';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { ProductPaymentGate } from '@/components/product-payment-gate';

export default async function ServerIdLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { serverId: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return auth().redirectToSignIn();
  }
  const server = await getServer(params.serverId, profile.id);
  if (!server) {
    return redirect('/');
  }

  // Configure which Stripe products are allowed for server access
  const allowedProductIds = [
    'prod_SWIyAf2tfVrJao', // Your current product ID
    // Add more product IDs here as you create them
  ];

  // Server access protection - bypass gate for legitimate users
  const shouldBypassGate =
    profile.isAdmin ||
    profile.subscriptionStatus === 'ACTIVE' ||
    (profile.subscriptionEnd && new Date(profile.subscriptionEnd) > new Date()); // Valid subscription not yet expired

  // Only log security checks when access is being restricted or when there's a potential issue
  if (!shouldBypassGate) {
    console.log('🔒 [Server Access Restricted]:', {
      serverId: params.serverId,
      serverName: server.name,
      email: profile.email,
      isAdmin: profile.isAdmin,
      subscriptionStatus: profile.subscriptionStatus,
      subscriptionEnd: profile.subscriptionEnd,
      subscriptionEndValid: profile.subscriptionEnd
        ? new Date(profile.subscriptionEnd) > new Date()
        : false,
      reason: 'User does not have valid subscription or admin access',
    });
  }

  const serverContent = (
    <section className='h-full overflow-visible'>
      <div className='hidden md:flex h-full w-60 z-20 flex-col fixed inset-y-0 left-[96px] overflow-visible'>
        {await ServerSideBar({ serverId: params.serverId })}
      </div>
      <main className='h-full md:pl-60 overflow-visible'>{children}</main>
    </section>
  );

  return shouldBypassGate ? (
    serverContent
  ) : (
    <ProductPaymentGate
      allowedProductIds={allowedProductIds}
      productName='Premium Server Access'
      upgradeUrl='https://buy.stripe.com/test_28E6oG8nd5Bm3N1esU4Ja01'
      features={[
        'Access to trading servers',
        'Real-time chat and discussions',
        'Premium trading signals',
        'Community insights and analysis',
      ]}
      adminBypass={false} // Let the component handle its own subscription checks
    >
      {serverContent}
    </ProductPaymentGate>
  );
}
