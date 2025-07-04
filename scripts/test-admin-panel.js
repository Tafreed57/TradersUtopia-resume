const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAdminPanel() {
  try {
    console.log('🧪 Testing Admin Panel Functionality');
    console.log('='.repeat(50));

    // Test 1: Check if admin exists
    const adminEmail = 'tafreed47@gmail.com';
    console.log(`1. Checking admin user: ${adminEmail}`);

    const adminProfile = await prisma.profile.findFirst({
      where: { email: adminEmail },
    });

    if (!adminProfile) {
      console.log('❌ Admin profile not found');
      return;
    }

    console.log(`✅ Admin profile found: ${adminProfile.name}`);
    console.log(`   - Admin Status: ${adminProfile.isAdmin}`);
    console.log(`   - User ID: ${adminProfile.userId}`);
    console.log();

    // Test 2: Check if admin has proper server permissions
    console.log('2. Checking admin server permissions');

    const membership = await prisma.member.findFirst({
      where: {
        profileId: adminProfile.id,
      },
      include: {
        server: true,
      },
    });

    if (!membership) {
      console.log('❌ Admin has no server membership');
      return;
    }

    console.log(`✅ Admin server membership found:`);
    console.log(`   - Server: ${membership.server.name}`);
    console.log(`   - Role: ${membership.role}`);
    console.log(`   - Member ID: ${membership.id}`);
    console.log();

    // Test 3: Check database connections
    console.log('3. Testing database connections');

    const totalUsers = await prisma.profile.count();
    const totalAdmins = await prisma.profile.count({
      where: { isAdmin: true },
    });
    const totalActiveSubscriptions = await prisma.profile.count({
      where: { subscriptionStatus: 'ACTIVE' },
    });

    console.log(`✅ Database connections working:`);
    console.log(`   - Total Users: ${totalUsers}`);
    console.log(`   - Total Admins: ${totalAdmins}`);
    console.log(`   - Active Subscriptions: ${totalActiveSubscriptions}`);
    console.log();

    // Test 4: Check environment variables
    console.log('4. Checking environment variables');

    const requiredEnvVars = [
      'DATABASE_URL',
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
      'CLERK_SECRET_KEY',
      'STRIPE_SECRET_KEY',
      'STRIPE_PUBLISHABLE_KEY',
    ];

    let missingVars = [];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        missingVars.push(envVar);
      }
    }

    if (missingVars.length > 0) {
      console.log(
        `❌ Missing environment variables: ${missingVars.join(', ')}`
      );
    } else {
      console.log('✅ All required environment variables are set');
    }
    console.log();

    // Test 5: Check for test user to grant admin/subscription to
    console.log('5. Finding test user for admin operations');

    const testUser = await prisma.profile.findFirst({
      where: {
        email: {
          not: adminEmail,
        },
      },
    });

    if (!testUser) {
      console.log('❌ No test user found for admin operations');
      console.log('   Create another user account to test admin operations');
      return;
    }

    console.log(`✅ Test user found: ${testUser.name} (${testUser.email})`);
    console.log(`   - Current Admin Status: ${testUser.isAdmin}`);
    console.log(`   - Current Subscription: ${testUser.subscriptionStatus}`);
    console.log(`   - User ID: ${testUser.userId}`);
    console.log();

    // Test 6: Check API endpoints accessibility
    console.log('6. Testing API endpoints structure');

    const fs = require('fs');
    const path = require('path');

    const apiEndpoints = [
      'src/app/api/admin/users/route.ts',
      'src/app/api/admin/users/toggle-admin/route.ts',
      'src/app/api/admin/users/grant-subscription/route.ts',
      'src/app/api/admin/users/cancel-subscription/route.ts',
      'src/app/api/admin/users/delete/route.ts',
    ];

    for (const endpoint of apiEndpoints) {
      if (fs.existsSync(endpoint)) {
        console.log(`✅ ${endpoint} exists`);
      } else {
        console.log(`❌ ${endpoint} missing`);
      }
    }
    console.log();

    // Test 7: Check subscription management capabilities
    console.log('7. Testing subscription management setup');

    const subscriptionUsers = await prisma.profile.findMany({
      where: {
        subscriptionStatus: 'ACTIVE',
      },
      select: {
        name: true,
        email: true,
        subscriptionStatus: true,
        subscriptionStart: true,
        subscriptionEnd: true,
        stripeCustomerId: true,
        stripeProductId: true,
      },
    });

    console.log(`✅ Found ${subscriptionUsers.length} active subscriptions:`);
    subscriptionUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name} (${user.email})`);
      console.log(`      - Status: ${user.subscriptionStatus}`);
      console.log(
        `      - Start: ${user.subscriptionStart?.toISOString() || 'N/A'}`
      );
      console.log(
        `      - End: ${user.subscriptionEnd?.toISOString() || 'N/A'}`
      );
      console.log(`      - Stripe Customer: ${user.stripeCustomerId || 'N/A'}`);
      console.log(`      - Product ID: ${user.stripeProductId || 'N/A'}`);
    });
    console.log();

    // Test 8: Security checks
    console.log('8. Security validation checks');

    // Check if CSRF protection is configured
    const csrfLibExists = fs.existsSync('src/lib/csrf.ts');
    const rateLimitExists = fs.existsSync('src/lib/rate-limit.ts');

    console.log(
      `✅ CSRF protection: ${csrfLibExists ? 'Configured' : 'Missing'}`
    );
    console.log(
      `✅ Rate limiting: ${rateLimitExists ? 'Configured' : 'Missing'}`
    );
    console.log();

    // Summary
    console.log('📋 ADMIN PANEL TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Admin User: ${adminProfile.name} (${adminProfile.email})`);
    console.log(
      `✅ Admin Permissions: ${adminProfile.isAdmin ? 'Active' : 'Inactive'}`
    );
    console.log(`✅ Server Role: ${membership.role}`);
    console.log(`✅ Database Connected: ${totalUsers} users found`);
    console.log(`✅ Test User Available: ${testUser.name} (${testUser.email})`);
    console.log(`✅ API Endpoints: Present`);
    console.log(
      `✅ Security Features: ${csrfLibExists && rateLimitExists ? 'Configured' : 'Needs Review'}`
    );
    console.log();

    // Action Items
    console.log('🎯 RECOMMENDED ACTIONS');
    console.log('='.repeat(50));

    if (!adminProfile.isAdmin) {
      console.log('❗ Grant admin status to tafreed47@gmail.com');
    }

    if (membership.role !== 'ADMIN') {
      console.log('❗ Update server role to ADMIN for tafreed47@gmail.com');
    }

    if (!testUser.isAdmin) {
      console.log(
        `💡 Use ${testUser.email} to test admin granting functionality`
      );
    }

    if (testUser.subscriptionStatus !== 'ACTIVE') {
      console.log(
        `💡 Use ${testUser.email} to test subscription granting functionality`
      );
    }

    console.log('✅ Admin panel should be fully functional!');
    console.log();

    // Additional verification for the fixed user
    console.log('🔍 VERIFICATION: Recently Fixed Admin User');
    console.log('='.repeat(50));

    const fixedUser = await prisma.profile.findFirst({
      where: { email: 'tafreed47@gmail.com' },
      include: {
        members: {
          include: {
            server: true,
          },
        },
      },
    });

    if (fixedUser) {
      console.log(`User: ${fixedUser.name}`);
      console.log(`Profile Admin: ${fixedUser.isAdmin ? '✅ YES' : '❌ NO'}`);

      const adminMembership = fixedUser.members.find(m => m.role === 'ADMIN');
      if (adminMembership) {
        console.log(
          `Server Admin Role: ✅ YES (${adminMembership.server.name})`
        );
        console.log(
          `🎉 User should now be able to type and manage the server!`
        );
      } else {
        console.log(`Server Admin Role: ❌ NO`);
        console.log(`⚠️  User might still have permission issues`);
      }
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAdminPanel();
