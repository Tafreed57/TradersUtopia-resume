const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAdminServerRolesFix() {
  try {
    console.log('🔍 Testing Admin Server Roles Fix');
    console.log('='.repeat(50));

    // Get all global admins
    const globalAdmins = await prisma.profile.findMany({
      where: { isAdmin: true },
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
      },
    });

    console.log(`👑 Found ${globalAdmins.length} global admins:`);
    globalAdmins.forEach((admin, index) => {
      console.log(`  ${index + 1}. ${admin.name} (${admin.email})`);
    });
    console.log();

    // Get all servers
    const allServers = await prisma.server.findMany({
      select: {
        id: true,
        name: true,
        profileId: true,
        profile: {
          select: {
            isAdmin: true,
            email: true,
          },
        },
      },
    });

    console.log(`🏰 Found ${allServers.length} servers:`);
    allServers.forEach((server, index) => {
      console.log(
        `  ${index + 1}. ${server.name} (Owner: ${server.profile?.email || 'Unknown'})`
      );
    });
    console.log();

    // Check each global admin's memberships
    let totalIssues = 0;
    let totalFixed = 0;

    for (const admin of globalAdmins) {
      console.log(`🔍 Checking ${admin.name} (${admin.email}):`);

      // Get all memberships for this admin
      const memberships = await prisma.member.findMany({
        where: { profileId: admin.id },
        include: {
          server: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      console.log(`  📋 Member of ${memberships.length} servers:`);

      let adminIssues = 0;
      for (const membership of memberships) {
        const roleStatus = membership.role === 'ADMIN' ? '✅' : '❌';
        console.log(
          `    ${roleStatus} ${membership.server.name}: ${membership.role}`
        );

        if (membership.role !== 'ADMIN') {
          adminIssues++;
          totalIssues++;
        }
      }

      // Check if admin is missing from any servers
      const memberServerIds = memberships.map(m => m.server.id);
      const missingServers = allServers.filter(
        s => !memberServerIds.includes(s.id)
      );

      if (missingServers.length > 0) {
        console.log(`  ⚠️  Missing from ${missingServers.length} servers:`);
        missingServers.forEach(server => {
          console.log(`    - ${server.name}`);
          totalIssues++;
        });
      }

      if (adminIssues === 0 && missingServers.length === 0) {
        console.log(`  ✅ Perfect! Admin has correct roles in all servers`);
        totalFixed++;
      } else {
        console.log(
          `  ❌ Found ${adminIssues} role issues and missing from ${missingServers.length} servers`
        );
      }

      console.log();
    }

    // Summary
    console.log('📊 SUMMARY');
    console.log('='.repeat(50));
    console.log(`👑 Global Admins: ${globalAdmins.length}`);
    console.log(`🏰 Total Servers: ${allServers.length}`);
    console.log(`✅ Admins with correct roles: ${totalFixed}`);
    console.log(`❌ Issues found: ${totalIssues}`);
    console.log();

    if (totalIssues > 0) {
      console.log('🔧 RECOMMENDATIONS');
      console.log('='.repeat(50));
      console.log(
        '❗ Issues found! Please run the "Fix Admin Server Roles" button in the admin panel.'
      );
      console.log('   This will:');
      console.log('   - Update ALL existing admin memberships to ADMIN role');
      console.log("   - Add admins to any servers they're missing from");
      console.log(
        '   - Ensure comprehensive admin permissions across all servers'
      );
      console.log();
    } else {
      console.log('🎉 All admin server roles are correctly configured!');
      console.log(
        '✅ No issues found. All global admins have ADMIN role in all servers.'
      );
      console.log();
    }

    // Additional verification - check specific permissions
    console.log('🔍 PERMISSION VERIFICATION');
    console.log('='.repeat(50));

    const adminServers = allServers.filter(s => s.profile?.isAdmin);
    const regularServers = allServers.filter(s => !s.profile?.isAdmin);

    console.log(`📈 Admin-created servers: ${adminServers.length}`);
    console.log(`📊 Regular servers: ${regularServers.length}`);
    console.log();

    // Check that all admins are in all admin-created servers
    for (const server of adminServers) {
      const adminMembers = await prisma.member.findMany({
        where: {
          serverId: server.id,
          profile: {
            isAdmin: true,
          },
        },
        include: {
          profile: {
            select: {
              email: true,
            },
          },
        },
      });

      console.log(`🏛️  ${server.name}:`);
      console.log(
        `   👑 Admin members: ${adminMembers.length}/${globalAdmins.length}`
      );

      const missingAdmins = globalAdmins.filter(
        admin => !adminMembers.some(member => member.profileId === admin.id)
      );

      if (missingAdmins.length > 0) {
        console.log(
          `   ❌ Missing admins: ${missingAdmins.map(a => a.email).join(', ')}`
        );
      } else {
        console.log(`   ✅ All global admins are members`);
      }
      console.log();
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAdminServerRolesFix();
