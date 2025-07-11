import { getCurrentProfileForAuth, getGeneralServer } from '@/lib/query';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

interface ServerIdPageProps {
  params: {
    serverId: string;
  };
}

export default async function ServerIdPage({ params }: ServerIdPageProps) {
  const profile = await getCurrentProfileForAuth();

  if (!profile) {
    const { redirectToSignIn } = await auth();
    return redirectToSignIn();
  }
  const generalServer = await getGeneralServer(params.serverId, profile.id);

  if (generalServer) {
    redirect(
      `/servers/${params.serverId}/channels/${generalServer?.channels?.[0]?.id}`
    );
  }
  if (!generalServer) {
    const { redirectToSignIn } = await auth();
    return redirectToSignIn();
  }
  return <div>New server</div>;
}
