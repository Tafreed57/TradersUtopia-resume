#!/usr/bin/env node

/**
 * Development script that handles command line arguments
 * Usage: pnpm dev --debug
 */

import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// Parse command line arguments
const args = process.argv.slice(2);
const isDebug = args.includes('--debug');
const isVerbose = args.includes('--verbose');

// Set up environment variables
const env = {
  ...process.env,
  // Ensure colors are preserved through the pipe
  FORCE_COLOR: '1',
  // Ensure NO_COLOR is not set unless explicitly wanted
  NO_COLOR: process.env.NO_COLOR || undefined,
};

// Only set debug/verbose if explicitly requested
if (isDebug) {
  env.ENABLE_DETAILED_LOGS = 'true';
  console.log('🐛 Debug mode enabled - detailed logging active');
} else {
  // Explicitly disable detailed logs for clean output
  env.ENABLE_DETAILED_LOGS = 'false';
}

if (isVerbose) {
  env.ENABLE_VERBOSE_LOGS = 'true';
  console.log('📝 Verbose mode enabled');
} else {
  // Explicitly disable verbose logs for clean output
  env.ENABLE_VERBOSE_LOGS = 'false';
}

console.log('🚀 Starting development servers...');
if (isDebug) {
  console.log('   • Next.js with detailed logging');
  console.log('   • Trigger.dev');
} else {
  console.log('   • Next.js');
  console.log('   • Trigger.dev');
}
console.log('');

// Construct the full command as a string for better shell compatibility
const command = `npx concurrently --kill-others --raw --names "next,trigger" --prefix-colors "yellow,blue" "next dev" "pnpm run trigger:dev"`;

// Execute the concurrently process
const child = exec(command, {
  env,
  cwd: rootDir,
});

// Pipe output to console
child.stdout?.pipe(process.stdout);
child.stderr?.pipe(process.stderr);

// Handle process exit
child.on('close', code => {
  process.exit(code || 0);
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down development servers...');
  child.kill('SIGINT');
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down development servers...');
  child.kill('SIGTERM');
});
