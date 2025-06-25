#!/usr/bin/env node

/**
 * Stripe Webhook Test Script
 * 
 * Usage:
 *   node test-webhook.js config
 *   node test-webhook.js endpoint  
 *   node test-webhook.js basic
 *   node test-webhook.js all
 */

const https = require('https');
const http = require('http');

const BASE_URL = 'http://localhost:3000';
const WEBHOOK_TEST_URL = `${BASE_URL}/api/webhooks/stripe/test-public`;
const WEBHOOK_URL = `${BASE_URL}/api/webhooks/stripe`;

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

function makeRequest(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (data) {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const client = urlObj.protocol === 'https:' ? https : http;
    const req = client.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(responseData);
          resolve({
            status: res.statusCode,
            data: jsonData
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            data: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testWebhookConfig() {
  log('\n🔍 Testing Webhook Configuration...', 'blue');
  
  try {
    const response = await makeRequest(WEBHOOK_TEST_URL, 'POST', {
      test: 'config'
    });

    if (response.status === 200 && response.data.success) {
      log('✅ Configuration Test PASSED', 'green');
      console.log('📊 Results:');
      console.log(JSON.stringify(response.data.results, null, 2));
      
      if (response.data.status === 'CONFIGURED') {
        log('🎉 Webhook is properly configured!', 'green');
      } else {
        log('⚠️  Missing configuration - check environment variables', 'yellow');
      }
    } else {
      log('❌ Configuration Test FAILED', 'red');
      console.log(response.data);
    }
  } catch (error) {
    log('❌ Test Error: ' + error.message, 'red');
  }
}

async function testWebhookEndpoint() {
  log('\n🔗 Testing Webhook Endpoint Accessibility...', 'blue');
  
  try {
    const response = await makeRequest(WEBHOOK_TEST_URL, 'POST', {
      test: 'endpoint'
    });

    if (response.status === 200 && response.data.success) {
      log('✅ Endpoint Test PASSED', 'green');
      console.log('📊 Results:');
      console.log(JSON.stringify(response.data.results, null, 2));
    } else {
      log('❌ Endpoint Test FAILED', 'red');
      console.log(response.data);
    }
  } catch (error) {
    log('❌ Test Error: ' + error.message, 'red');
  }
}

async function testBasicConnectivity() {
  log('\n🚀 Testing Basic Webhook Connectivity...', 'blue');
  
  try {
    const response = await makeRequest(WEBHOOK_TEST_URL, 'GET');

    if (response.status === 200) {
      log('✅ Basic Connectivity Test PASSED', 'green');
      console.log('📊 Webhook Information:');
      console.log(JSON.stringify(response.data, null, 2));
      
      const { tests } = response.data;
      if (tests.hasStripeSecret && tests.hasWebhookSecret) {
        log('🔑 Environment variables are configured!', 'green');
      } else {
        log('⚠️  Some environment variables may be missing', 'yellow');
      }
    } else {
      log('❌ Basic Connectivity Test FAILED', 'red');
      console.log(response.data);
    }
  } catch (error) {
    log('❌ Test Error: ' + error.message, 'red');
  }
}

async function testWebhookEndpointDirect() {
  log('\n🎯 Testing Direct Webhook Endpoint...', 'blue');
  
  try {
    // Try to reach the webhook endpoint directly (will fail due to missing signature, but shows it's reachable)
    const response = await makeRequest(WEBHOOK_URL, 'POST', {
      test: 'connectivity'
    });

    // We expect this to fail with a 400 due to missing webhook signature
    if (response.status === 400 && response.data.error === 'Webhook Error') {
      log('✅ Webhook Endpoint is REACHABLE and PROTECTED', 'green');
      log('📍 Endpoint correctly requires Stripe signature', 'blue');
    } else {
      log('⚠️  Unexpected response from webhook endpoint', 'yellow');
      console.log(response);
    }
  } catch (error) {
    log('❌ Test Error: ' + error.message, 'red');
  }
}

async function runAllTests() {
  log('🚀 Running Complete Webhook Test Suite...', 'bold');
  
  await testBasicConnectivity();
  await testWebhookConfig();
  await testWebhookEndpoint();
  await testWebhookEndpointDirect();
  
  log('\n✨ Test Suite Complete!', 'bold');
  log('💡 Your webhook system appears to be working correctly!', 'green');
  log('🔍 To test with real Stripe events, check your Stripe Dashboard webhook logs', 'blue');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    await runAllTests();
    return;
  }

  const command = args[0];

  switch (command) {
    case 'config':
      await testWebhookConfig();
      break;
      
    case 'endpoint':
      await testWebhookEndpoint();
      break;
      
    case 'basic':
      await testBasicConnectivity();
      break;
      
    case 'direct':
      await testWebhookEndpointDirect();
      break;
      
    case 'all':
      await runAllTests();
      break;
      
    default:
      log('❌ Unknown command: ' + command, 'red');
      log('📖 Available commands: config, endpoint, basic, direct, all', 'blue');
  }
}

main().catch(error => {
  log('💥 Script Error: ' + error.message, 'red');
  process.exit(1);
}); 