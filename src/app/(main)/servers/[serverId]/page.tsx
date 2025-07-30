import { getCurrentProfileForAuth } from '@/lib/query';
import { ServerService } from '@/services/database/server-service';
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

  const server = await new ServerService().findServerWithMemberAccess(
    params.serverId,
    profile.id
  );

  if (server) {
    redirect(
      `/servers/${params.serverId}/channels/${server?.channels?.[0]?.id}`
    );
  }
  if (!server) {
    const { redirectToSignIn } = await auth();
    return redirectToSignIn();
  }
  return <div>New server</div>;
}
