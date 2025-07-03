import { ServerSideBar } from '@/components/layout/server-side-bar';
import { getCurrentProfile, getServer } from '@/lib/query';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

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
  return (
    <section className='h-full overflow-visible'>
      <div className='hidden md:flex h-full w-60 z-20 flex-col fixed inset-y-0 left-[96px] overflow-visible'>
        {await ServerSideBar({ serverId: params.serverId })}
      </div>
      <main className='h-full md:pl-60 overflow-visible'>{children}</main>
    </section>
  );
}
