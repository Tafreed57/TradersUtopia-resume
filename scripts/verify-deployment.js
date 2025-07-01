#!/usr/bin/env node

/**
 * Post-Deployment Verification Script
 *
 * This script verifies that the deployment is working correctly
 * by testing various endpoints and services.
 *
 * Usage:
 * node scripts/verify-deployment.js https://your-app.amplifyapp.com
 */

const https = require('https');
const http = require('http');

const args = process.argv.slice(2);
const baseUrl = args[0];

if (!baseUrl) {
  console.error('❌ Please provide the deployment URL');
  console.error(
    'Usage: node scripts/verify-deployment.js https://your-app.amplifyapp.com'
  );
  process.exit(1);
}

console.log(`🔍 Verifying deployment at: ${baseUrl}`);

// Test endpoints
const tests = [
  {
    name: 'Homepage',
    path: '/',
    expectedStatus: 200,
    description: 'Main application page',
  },
  {
    name: 'Health Check',
    path: '/api/health',
    expectedStatus: 200,
    description: 'Application health endpoint',
  },
  {
    name: 'Sign In Page',
    path: '/sign-in',
    expectedStatus: 200,
    description: 'Authentication page',
  },
  {
    name: 'Pricing Page',
    path: '/pricing',
    expectedStatus: 200,
    description: 'Pricing information page',
  },
  {
    name: 'CSRF Token',
    path: '/api/csrf-token',
    expectedStatus: 200,
    description: 'CSRF protection endpoint',
  },
];

async function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const request = protocol.get(url, response => {
      let data = '';

      response.on('data', chunk => {
        data += chunk;
      });

      response.on('end', () => {
        resolve({
          statusCode: response.statusCode,
          headers: response.headers,
          data: data,
        });
      });
    });

    request.on('error', error => {
      reject(error);
    });

    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function runTest(test) {
  const url = `${baseUrl}${test.path}`;

  try {
    console.log(`\n🧪 Testing: ${test.name}`);
    console.log(`   URL: ${url}`);
    console.log(`   Expected: ${test.description}`);

    const response = await makeRequest(url);

    if (response.statusCode === test.expectedStatus) {
      console.log(`   ✅ PASS - Status: ${response.statusCode}`);

      // Special checks for specific endpoints
      if (test.path === '/api/health') {
        try {
          const healthData = JSON.parse(response.data);
          if (healthData.status === 'healthy') {
            console.log(`   ✅ Health check reports: ${healthData.message}`);
            console.log(`   📊 Database: ${healthData.database}`);
            console.log(`   🌍 Environment: ${healthData.environment}`);
          } else {
            console.log(
              `   ⚠️  Health check reports issues: ${healthData.message}`
            );
          }
        } catch (e) {
          console.log(`   ⚠️  Health endpoint returned non-JSON response`);
        }
      }

      return true;
    } else {
      console.log(
        `   ❌ FAIL - Expected ${test.expectedStatus}, got ${response.statusCode}`
      );
      return false;
    }
  } catch (error) {
    console.log(`   ❌ ERROR - ${error.message}`);
    return false;
  }
}

async function verifyDeployment() {
  console.log('🚀 Starting deployment verification...\n');

  const results = [];

  for (const test of tests) {
    const passed = await runTest(test);
    results.push({ name: test.name, passed });
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📋 VERIFICATION SUMMARY');
  console.log('='.repeat(50));

  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;

  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${result.name}`);
  });

  console.log('='.repeat(50));
  console.log(`📊 Results: ${passedTests}/${totalTests} tests passed`);

  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Your deployment looks good.');

    console.log('\n🔧 Next Steps:');
    console.log('1. Test user authentication (sign up/sign in)');
    console.log('2. Verify database operations (create server, channels)');
    console.log('3. Test payment flows (if applicable)');
    console.log('4. Check video/audio functionality');
    console.log('5. Verify email notifications');
    console.log('6. Test file uploads');

    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please check the issues above.');
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check AWS Amplify build logs');
    console.log('2. Verify environment variables');
    console.log('3. Check database connectivity');
    console.log('4. Review application logs in CloudWatch');
    console.log(
      '5. Consult the troubleshooting guide: docs/AMPLIFY_TROUBLESHOOTING.md'
    );

    process.exit(1);
  }
}

// Additional checks
async function checkSecurityHeaders() {
  console.log('\n🔒 Checking Security Headers...');

  try {
    const response = await makeRequest(baseUrl);
    const headers = response.headers;

    const securityHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'x-xss-protection',
      'strict-transport-security',
    ];

    securityHeaders.forEach(header => {
      if (headers[header]) {
        console.log(`   ✅ ${header}: ${headers[header]}`);
      } else {
        console.log(`   ⚠️  Missing: ${header}`);
      }
    });
  } catch (error) {
    console.log(`   ❌ Could not check security headers: ${error.message}`);
  }
}

// Run verification
async function main() {
  await verifyDeployment();
  await checkSecurityHeaders();
}

main().catch(console.error);
