import { prisma } from '@/lib/prismadb';
import { getCurrentProfile } from '@/lib/query';
import { redirect } from 'next/navigation';

export default async function InviteCodePage({
  params,
}: {
  params: { inviteCode: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return redirect('/sign-in');
  }

  if (!params.inviteCode) {
    return redirect('/');
  }

  const existingServer = await prisma.server.findFirst({
    where: {
      inviteCode: params.inviteCode,
      members: {
        some: {
          profileId: profile.id,
        },
      },
    },
  });

  if (existingServer) {
    return redirect(`/servers/${existingServer.id}`);
  }

  try {
    const server = await prisma.server.update({
      where: {
        inviteCode: params.inviteCode,
      },
      data: {
        members: {
          create: {
            profileId: profile.id,
          },
        },
      },
    });
    if (server) {
      return redirect(`/servers/${server.id}`);
    }
  } catch (error) {
    //
  }

  return null;
}
