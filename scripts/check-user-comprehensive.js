const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUserComprehensive() {
  try {
    const email = 'tafreed47@gmail.com';

    console.log('🔍 Comprehensive User Check for:', email);
    console.log('='.repeat(50));

    // Check profile
    const profile = await prisma.profile.findFirst({
      where: { email },
      include: {
        servers: {
          include: {
            channels: true,
          },
        },
        members: {
          include: {
            server: true,
          },
        },
      },
    });

    if (!profile) {
      console.log('❌ Profile not found for:', email);
      return;
    }

    console.log('👤 Profile Info:');
    console.log(`   Name: ${profile.name}`);
    console.log(`   Email: ${profile.email}`);
    console.log(`   Admin Status: ${profile.isAdmin ? '✅ YES' : '❌ NO'}`);
    console.log(`   User ID: ${profile.userId}`);
    console.log();

    // Check server ownership
    console.log('🏢 Server Ownership:');
    if (profile.servers.length > 0) {
      profile.servers.forEach(server => {
        console.log(`   ✅ Owns server: ${server.name} (ID: ${server.id})`);
        console.log(`      Invite Code: ${server.inviteCode}`);
        console.log(`      Channels: ${server.channels.length}`);
      });
    } else {
      console.log('   ❌ No servers owned');
    }
    console.log();

    // Check server memberships
    console.log('👥 Server Memberships:');
    if (profile.members.length > 0) {
      profile.members.forEach(member => {
        console.log(`   Server: ${member.server.name}`);
        console.log(`   Role: ${member.role}`);
        console.log(`   Member ID: ${member.id}`);
        console.log(`   Server ID: ${member.serverId}`);
        console.log('   ---');
      });
    } else {
      console.log('   ❌ No server memberships found');
    }
    console.log();

    // Check the main trading server specifically
    const mainServer = await prisma.server.findFirst({
      where: {
        name: 'Traders Utopia',
      },
      include: {
        members: {
          where: {
            profile: {
              email: email,
            },
          },
        },
        channels: true,
      },
    });

    console.log('🏛️ Main Trading Server Analysis:');
    if (mainServer) {
      console.log(`   Server: ${mainServer.name} (ID: ${mainServer.id})`);
      console.log(`   Total Channels: ${mainServer.channels.length}`);

      if (mainServer.members.length > 0) {
        const membership = mainServer.members[0];
        console.log(`   ✅ User is member with role: ${membership.role}`);
        console.log(`   Member ID: ${membership.id}`);

        // Check if role should be ADMIN
        if (profile.isAdmin && membership.role !== 'ADMIN') {
          console.log(
            '   ⚠️  WARNING: User has admin profile but GUEST/MEMBER role in server!'
          );
          console.log('   🔧 This needs to be fixed for proper permissions');
        }
      } else {
        console.log('   ❌ User is NOT a member of the main server');
        console.log(
          '   🔧 This needs to be fixed - user should be auto-joined'
        );
      }
    } else {
      console.log('   ❌ Main trading server not found');
    }

    console.log();
    console.log('📋 Summary:');
    console.log(`   Profile Admin: ${profile.isAdmin ? 'YES' : 'NO'}`);
    console.log(`   Server Memberships: ${profile.members.length}`);
    console.log(`   Server Ownerships: ${profile.servers.length}`);

    if (profile.isAdmin && profile.members.length > 0) {
      const hasAdminRole = profile.members.some(m => m.role === 'ADMIN');
      console.log(
        `   Has Admin Role in Server: ${hasAdminRole ? 'YES' : 'NO'}`
      );

      if (!hasAdminRole) {
        console.log(
          '   🚨 ISSUE IDENTIFIED: Admin profile but no ADMIN role in server!'
        );
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserComprehensive();
