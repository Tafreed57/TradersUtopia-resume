// Direct database query to check admin status
// Run with: node scripts/check-admin-direct.js <email>

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function checkAdminStatusDirect(email) {
  try {
    console.log(`🔍 Checking admin status for: ${email}`);
    console.log(
      `📡 Database URL: ${process.env.DATABASE_URL ? 'Connected' : 'Not Found'}`
    );

    // Find all profiles for this email
    const profiles = await prisma.profile.findMany({
      where: {
        email: email.toLowerCase(),
      },
      select: {
        id: true,
        userId: true,
        email: true,
        name: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
        subscriptionStatus: true,
      },
    });

    if (profiles.length === 0) {
      console.log(`❌ No profiles found for ${email}`);
      return { found: false, email, profiles: [] };
    }

    console.log(`✅ Found ${profiles.length} profile(s) for ${email}`);

    // Check if any profile has admin privileges
    const hasAdminProfile = profiles.some(profile => profile.isAdmin);

    console.log(`👑 Has admin access: ${hasAdminProfile ? 'YES' : 'NO'}`);
    console.log('\n📋 Profile details:');

    profiles.forEach((profile, index) => {
      console.log(`\n  Profile ${index + 1}:`);
      console.log(`    ID: ${profile.id}`);
      console.log(`    User ID: ${profile.userId}`);
      console.log(`    Name: ${profile.name}`);
      console.log(`    Email: ${profile.email}`);
      console.log(`    Admin: ${profile.isAdmin ? 'YES' : 'NO'}`);
      console.log(`    Subscription: ${profile.subscriptionStatus}`);
      console.log(
        `    Created: ${new Date(profile.createdAt).toLocaleString()}`
      );
      console.log(
        `    Updated: ${new Date(profile.updatedAt).toLocaleString()}`
      );
    });

    return {
      found: true,
      email,
      hasAdminAccess: hasAdminProfile,
      profileCount: profiles.length,
      profiles,
    };
  } catch (error) {
    console.error('❌ Error checking admin status:', error);
    return { error: error.message };
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.log('Usage: node scripts/check-admin-direct.js <email>');
  console.log(
    'Example: node scripts/check-admin-direct.js tafreed47@gmail.com'
  );
  process.exit(1);
}

// Run the check
checkAdminStatusDirect(email)
  .then(result => {
    if (result.error) {
      console.log('\n❌ Check failed:', result.error);
      process.exit(1);
    } else {
      console.log('\n✅ Check completed successfully');
      process.exit(0);
    }
  })
  .catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
