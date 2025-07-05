// Direct database query to grant admin access
// Run with: node scripts/grant-admin-direct.js <email>

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function grantAdminAccessDirect(email) {
  try {
    console.log(`🔍 Granting admin access to: ${email}`);
    console.log(
      `📡 Database URL: ${process.env.DATABASE_URL ? 'Connected' : 'Not Found'}`
    );

    // Find the profile for this email
    const profile = await prisma.profile.findFirst({
      where: {
        email: email.toLowerCase(),
      },
      select: {
        id: true,
        userId: true,
        email: true,
        name: true,
        isAdmin: true,
        subscriptionStatus: true,
      },
    });

    if (!profile) {
      console.log(`❌ No profile found for ${email}`);
      return { found: false, email };
    }

    console.log(`✅ Found profile for ${email}`);
    console.log(`   Current admin status: ${profile.isAdmin ? 'YES' : 'NO'}`);

    if (profile.isAdmin) {
      console.log(`ℹ️  ${email} already has admin access`);
      return {
        found: true,
        email,
        alreadyAdmin: true,
        profile,
      };
    }

    // Grant admin access
    console.log(`🔄 Granting admin access to ${email}...`);

    const updatedProfile = await prisma.profile.update({
      where: { id: profile.id },
      data: {
        isAdmin: true,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        userId: true,
        email: true,
        name: true,
        isAdmin: true,
        subscriptionStatus: true,
        updatedAt: true,
      },
    });

    console.log(`✅ Successfully granted admin access to ${email}`);
    console.log(`\n📋 Updated profile details:`);
    console.log(`    ID: ${updatedProfile.id}`);
    console.log(`    User ID: ${updatedProfile.userId}`);
    console.log(`    Name: ${updatedProfile.name}`);
    console.log(`    Email: ${updatedProfile.email}`);
    console.log(`    Admin: ${updatedProfile.isAdmin ? 'YES' : 'NO'}`);
    console.log(`    Subscription: ${updatedProfile.subscriptionStatus}`);
    console.log(
      `    Updated: ${new Date(updatedProfile.updatedAt).toLocaleString()}`
    );

    return {
      found: true,
      email,
      granted: true,
      profile: updatedProfile,
    };
  } catch (error) {
    console.error('❌ Error granting admin access:', error);
    return { error: error.message };
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.log('Usage: node scripts/grant-admin-direct.js <email>');
  console.log(
    'Example: node scripts/grant-admin-direct.js tafreed47@gmail.com'
  );
  process.exit(1);
}

// Confirmation prompt
console.log(`⚠️  About to grant admin access to: ${email}`);
console.log('This will give full administrative privileges to this user.');
console.log('Are you sure you want to continue? (Press Ctrl+C to cancel)');

// Add a small delay to let user read the warning
setTimeout(() => {
  // Run the grant
  grantAdminAccessDirect(email)
    .then(result => {
      if (result.error) {
        console.log('\n❌ Grant failed:', result.error);
        process.exit(1);
      } else if (result.alreadyAdmin) {
        console.log('\n✅ User already has admin access');
        process.exit(0);
      } else if (result.granted) {
        console.log('\n✅ Admin access granted successfully');
        console.log('\n🔄 Next steps:');
        console.log('1. Clear browser cache/cookies');
        console.log('2. Sign out and sign back in');
        console.log(
          '3. The admin panel should now be visible in the dashboard'
        );
        process.exit(0);
      } else {
        console.log('\n❌ User not found');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Unexpected error:', error);
      process.exit(1);
    });
}, 2000);
