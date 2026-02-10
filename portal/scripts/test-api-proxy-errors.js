#!/usr/bin/env node

/**
 * Simple test to demonstrate the API proxy error handling improvements
 * This can be run locally to verify error responses
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function testEndpoint(description, path, options = {}) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TEST: ${description}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Path: ${path}`);
  
  try {
    const response = await fetch(`${BASE_URL}${path}`, options);
    const contentType = response.headers.get('content-type');
    
    console.log(`\nStatus: ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${contentType}`);
    
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      console.log('\nResponse Body:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      const text = await response.text();
      console.log('\nResponse Body:');
      console.log(text.substring(0, 500));
    }
    
    return { success: response.ok, status: response.status };
  } catch (error) {
    console.error('\nError occurred:', error.message);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('API Proxy Error Handling Tests');
  console.log(`Testing against: ${BASE_URL}`);
  
  const results = [];
  
  // Test 1: Missing client ID
  results.push(await testEndpoint(
    'Missing Client ID',
    '/api/clients//templates'
  ));
  
  // Test 2: Invalid client ID (should proxy to backend)
  results.push(await testEndpoint(
    'Invalid Client ID',
    '/api/clients/999999/templates'
  ));
  
  // Test 3: Valid looking client ID (may fail on backend if not configured)
  results.push(await testEndpoint(
    'Valid Client ID Format',
    '/api/clients/1/templates'
  ));
  
  // Test 4: POST request (should handle differently)
  results.push(await testEndpoint(
    'POST Request',
    '/api/clients/1/templates',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test_template' })
    }
  ));
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(80)}`);
  results.forEach((result, index) => {
    console.log(`Test ${index + 1}: ${result.success ? '✓ PASS' : '✗ FAIL'} (Status: ${result.status || result.error})`);
  });
  
  console.log('\nNOTE: These tests verify error handling, not successful responses.');
  console.log('Expected behavior:');
  console.log('- Missing client ID should return 400 with error details');
  console.log('- Other requests should either succeed or return detailed error from upstream');
  console.log('\nCheck server logs for detailed [apiProxy] messages.');
}

if (typeof require !== 'undefined' && require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testEndpoint, runTests };
