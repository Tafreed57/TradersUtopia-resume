const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixAdminMemberRole() {
  try {
    const email = 'tafreed47@gmail.com';

    console.log('🔧 Fixing Admin Member Role for:', email);
    console.log('='.repeat(50));

    // Find the profile
    const profile = await prisma.profile.findFirst({
      where: { email },
      include: {
        members: {
          include: {
            server: true,
          },
        },
      },
    });

    if (!profile) {
      console.log('❌ Profile not found');
      return;
    }

    if (!profile.isAdmin) {
      console.log('❌ Profile is not admin');
      return;
    }

    console.log('👤 Profile found:', profile.name);
    console.log('✅ Profile is admin');

    // Find their membership in the main server
    const mainServer = await prisma.server.findFirst({
      where: {
        name: 'Traders Utopia',
      },
    });

    if (!mainServer) {
      console.log('❌ Main server not found');
      return;
    }

    console.log('🏛️ Main server found:', mainServer.name);

    // Find their membership
    const membership = await prisma.member.findFirst({
      where: {
        profileId: profile.id,
        serverId: mainServer.id,
      },
    });

    if (!membership) {
      console.log('❌ User is not a member of the main server');
      return;
    }

    console.log('👥 Current member role:', membership.role);

    if (membership.role === 'ADMIN') {
      console.log('✅ User already has ADMIN role');
      return;
    }

    // Update the member role to ADMIN
    console.log('🔄 Updating member role from', membership.role, 'to ADMIN...');

    const updatedMember = await prisma.member.update({
      where: {
        id: membership.id,
      },
      data: {
        role: 'ADMIN',
      },
    });

    console.log('✅ Successfully updated member role to:', updatedMember.role);
    console.log('🎉 Admin user can now type and manage the server!');

    // Verify the change
    const verification = await prisma.member.findUnique({
      where: {
        id: membership.id,
      },
    });

    console.log('🔍 Verification - Current role:', verification?.role);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAdminMemberRole();
