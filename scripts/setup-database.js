#!/usr/bin/env node

/**
 * Database Setup Script for AWS Amplify Deployment
 *
 * This script helps set up the database during initial deployment.
 * It runs Prisma migrations and optionally seeds the database.
 *
 * Usage:
 * node scripts/setup-database.js [--seed]
 */

const { execSync } = require('child_process');
const { existsSync } = require('fs');

const args = process.argv.slice(2);
const shouldSeed = args.includes('--seed');

console.log('🚀 Starting database setup...');

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

console.log('✅ DATABASE_URL is configured');

try {
  // Run Prisma migrations
  console.log('📦 Running Prisma migrations...');
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env },
  });
  console.log('✅ Migrations completed successfully');

  // Generate Prisma client
  console.log('🔧 Generating Prisma client...');
  execSync('npx prisma generate', {
    stdio: 'inherit',
    env: { ...process.env },
  });
  console.log('✅ Prisma client generated successfully');

  // Run seeding if requested and seed file exists
  if (shouldSeed) {
    const seedFile = 'prisma/seed.ts';
    if (existsSync(seedFile)) {
      console.log('🌱 Running database seed...');
      execSync('npx prisma db seed', {
        stdio: 'inherit',
        env: { ...process.env },
      });
      console.log('✅ Database seeded successfully');
    } else {
      console.log('⚠️  Seed file not found, skipping seeding');
    }
  }

  console.log('🎉 Database setup completed successfully!');
} catch (error) {
  console.error('❌ Database setup failed:', error.message);
  process.exit(1);
}
