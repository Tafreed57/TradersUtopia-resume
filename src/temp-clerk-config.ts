// ⚠️ TEMPORARY TESTING ONLY - DO NOT USE IN PRODUCTION
// This file is for testing if hard-coding the environment variable resolves the issue

// SECURITY WARNING: Never commit actual secrets to git!
// Only use this for testing with placeholder values

export const tempClerkConfig = {
  // Replace with your actual values for testing
  CLERK_SECRET_KEY: 'sk_test_your_key_here_for_testing_only',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_your_key_here',
};

// To use this (TESTING ONLY):
// 1. Replace the placeholder values above with your actual keys
// 2. Import this in middleware.ts:
//    import { tempClerkConfig } from './temp-clerk-config';
// 3. Use: process.env.CLERK_SECRET_KEY = tempClerkConfig.CLERK_SECRET_KEY;
// 4. DELETE THIS FILE after testing!

console.log(
  '🚨 WARNING: Using temporary hard-coded Clerk configuration for testing'
);
console.log(
  '🚨 DELETE src/temp-clerk-config.ts after resolving environment variable issues'
);
