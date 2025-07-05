const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUserPassword() {
  try {
    const email = 'tafreed47@gmail.com';

    console.log('🔑 Checking Password Setup for:', email);
    console.log('='.repeat(50));

    // Check profile in database
    const profile = await prisma.profile.findFirst({
      where: { email },
    });

    if (!profile) {
      console.log('❌ Profile not found for:', email);
      return;
    }

    console.log('👤 Profile Info:');
    console.log(`   Name: ${profile.name}`);
    console.log(`   Email: ${profile.email}`);
    console.log(`   User ID: ${profile.userId}`);
    console.log(`   Admin Status: ${profile.isAdmin}`);
    console.log();

    // Check Clerk authentication data
    console.log('🔍 Checking Clerk Authentication Data...');

    try {
      // We need to check environment variables first
      if (!process.env.CLERK_SECRET_KEY) {
        console.log('❌ CLERK_SECRET_KEY not found in environment variables');
        console.log('   Cannot check Clerk authentication data');
        return;
      }

      // Import Clerk client
      const { clerkClient } = require('@clerk/nextjs/server');

      const clerkUser = await clerkClient.users.getUser(profile.userId);

      console.log('✅ Clerk User Data Retrieved:');
      console.log(`   Clerk ID: ${clerkUser.id}`);
      console.log(`   Username: ${clerkUser.username || 'Not set'}`);
      console.log(`   First Name: ${clerkUser.firstName || 'Not set'}`);
      console.log(`   Last Name: ${clerkUser.lastName || 'Not set'}`);
      console.log(
        `   Password Enabled: ${clerkUser.passwordEnabled ? '✅ YES' : '❌ NO'}`
      );
      console.log(`   Email Addresses: ${clerkUser.emailAddresses.length}`);
      console.log(`   Phone Numbers: ${clerkUser.phoneNumbers.length}`);
      console.log(`   External Accounts: ${clerkUser.externalAccounts.length}`);
      console.log(
        `   Created At: ${new Date(clerkUser.createdAt).toISOString()}`
      );
      console.log(
        `   Last Sign In: ${clerkUser.lastSignInAt ? new Date(clerkUser.lastSignInAt).toISOString() : 'Never'}`
      );
      console.log();

      // Check email verification status
      console.log('📧 Email Verification Status:');
      clerkUser.emailAddresses.forEach((email, index) => {
        console.log(`   ${index + 1}. ${email.emailAddress}`);
        console.log(
          `      Verified: ${email.verification ? '✅ YES' : '❌ NO'}`
        );
        console.log(
          `      Primary: ${email.id === clerkUser.primaryEmailAddressId ? '✅ YES' : '❌ NO'}`
        );
      });
      console.log();

      // Check external authentication methods
      console.log('🔗 External Authentication Methods:');
      if (clerkUser.externalAccounts.length > 0) {
        clerkUser.externalAccounts.forEach((account, index) => {
          console.log(
            `   ${index + 1}. ${account.provider} (${account.emailAddress || 'No email'})`
          );
          console.log(
            `      Verified: ${account.verification ? '✅ YES' : '❌ NO'}`
          );
        });
      } else {
        console.log('   None found');
      }
      console.log();

      // Analysis and recommendations
      console.log('📋 PASSWORD ANALYSIS');
      console.log('='.repeat(50));

      if (clerkUser.passwordEnabled) {
        console.log('✅ GOOD: User has password authentication enabled');
        console.log(
          '✅ User CAN cancel their subscription using password verification'
        );
        console.log();

        // Check if they have backup authentication methods
        if (clerkUser.externalAccounts.length > 0) {
          console.log('ℹ️  Additional Authentication Methods Available:');
          clerkUser.externalAccounts.forEach(account => {
            console.log(`   - ${account.provider} authentication`);
          });
        }
      } else {
        console.log(
          '⚠️  WARNING: User does NOT have password authentication enabled'
        );
        console.log(
          '❌ User CANNOT cancel subscription without setting up a password first'
        );
        console.log();

        if (clerkUser.externalAccounts.length > 0) {
          console.log('ℹ️  Current Authentication Methods:');
          clerkUser.externalAccounts.forEach(account => {
            console.log(`   - ${account.provider} OAuth only`);
          });
          console.log();
          console.log('🔧 RECOMMENDED ACTIONS:');
          console.log('   1. User should set up a password in their profile');
          console.log(
            '   2. Navigate to User Profile → Security → Set Password'
          );
          console.log(
            '   3. After setting password, they can cancel subscription'
          );
        } else {
          console.log('🚨 CRITICAL: No authentication methods found!');
          console.log('   This user account may have authentication issues');
        }
      }

      console.log();
      console.log('🎯 NEXT STEPS FOR SUBSCRIPTION CANCELLATION');
      console.log('='.repeat(50));

      if (clerkUser.passwordEnabled) {
        console.log('✅ User is ready to cancel subscription');
        console.log('   Process: Dashboard → Settings → Subscription → Cancel');
        console.log('   Verification: Enter current password when prompted');
      } else {
        console.log('❗ User needs to set up password first');
        console.log('   Step 1: Go to Dashboard → Profile → Security');
        console.log('   Step 2: Set up a local password');
        console.log('   Step 3: Then proceed with subscription cancellation');
      }
    } catch (clerkError) {
      console.error('❌ Error fetching Clerk data:', clerkError);
      if (clerkError.status === 404) {
        console.log('   User may have been deleted from Clerk');
      } else {
        console.log('   Check CLERK_SECRET_KEY environment variable');
        console.log('   Ensure Clerk is properly configured');
      }
    }
  } catch (error) {
    console.error('❌ Script error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserPassword();
