// Simple test script for testing SnapTrade integration

// This utility will help us make a test request to the API
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';

// Base URL for the API (adjust if needed)
const BASE_URL = 'http://localhost:5000';

// Same JWT secret as in the server
const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret-key-should-be-in-env-var";

// Use the development fallback user ID from utils.ts
const TEST_USER_ID = 2;

// Create a JWT token for our test user (same logic as in server/routes.ts)
const TEST_TOKEN = jwt.sign({ userId: TEST_USER_ID }, JWT_SECRET, { expiresIn: '24h' });

// For storing the auth token from registration (if successful)
let AUTH_TOKEN = TEST_TOKEN; // Start with our test token

// 1. First test the /status endpoint which doesn't require authentication
async function testStatusEndpoint() {
  console.log('\n1. Testing SnapTrade status endpoint...');
  try {
    const response = await fetch(`${BASE_URL}/api/snaptrade/status`);
    const data = await response.json();
    console.log('Status response:', data);
    return data;
  } catch (error) {
    console.error('Error checking status:', error);
    return null;
  }
}

// 2. Test the /brokerages endpoint which doesn't require user auth
async function testBrokeragesEndpoint() {
  console.log('\n2. Testing SnapTrade brokerages endpoint...');
  try {
    const response = await fetch(`${BASE_URL}/api/snaptrade/brokerages`);
    const data = await response.json();
    console.log(`Found ${data.brokerages?.length || 0} brokerages`);
    // Only show the first 3 for brevity
    if (data.brokerages && data.brokerages.length > 0) {
      console.log('First 3 brokerages:', data.brokerages.slice(0, 3).map(b => b.name).join(', '));
    }
    return data;
  } catch (error) {
    console.error('Error fetching brokerages:', error);
    return null;
  }
}



// Register a test user
async function registerTestUser() {
  console.log('\nRegistering test user...');
  try {
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: `testuser_${Date.now()}`,
        email: `test${Date.now()}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User'
      })
    });
    
    const data = await response.json();
    console.log('Registration response:', data.user ? 'Success' : 'Failed');
    
    if (data.token) {
      AUTH_TOKEN = data.token;
      console.log('Got authentication token');
      return data.user;
    }
    return null;
  } catch (error) {
    console.error('Error registering test user:', error);
    return null;
  }
}

// Test the connect endpoint with authenticated user
async function testConnectEndpoint() {
  console.log('\n3. Testing SnapTrade connect endpoint...');
  try {
    // In development mode, we can use the fallback user ID via utils.ts extractUserId
    // But we'll use our auth token if we have it
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (AUTH_TOKEN) {
      headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
      console.log('Using authentication token for request');
    } else {
      console.log('No auth token available, using development fallback ID');
      // Still proceed since there's a fallback in development mode
    }
    
    const response = await fetch(`${BASE_URL}/api/snaptrade/connect`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        redirectUri: 'http://localhost:5000/callback'
      })
    });
    
    const data = await response.json();
    console.log('Connect response:', data);
    
    // If we got a redirectUri back, that's success!
    if (data.redirectUri) {
      console.log('SUCCESS: Received redirect URI for broker connection');
    }
    
    return data;
  } catch (error) {
    console.error('Error connecting to SnapTrade:', error);
    return null;
  }
}

// Run all tests in sequence
async function runTests() {
  console.log('===== SNAPTRADE API TEST =====');
  
  // Test status
  const statusResult = await testStatusEndpoint();
  
  // Test brokerages
  const brokeragesResult = await testBrokeragesEndpoint();
  
  // Try to register a test user, but don't require it in development
  // since we have the fallback ID in utils.ts
  try {
    const user = await registerTestUser();
    if (user) {
      console.log('Successfully registered test user');
    } else {
      console.log('User registration failed, but continuing with fallback ID');
    }
  } catch (error) {
    console.log('User registration error, continuing with fallback ID');
  }
  
  // Only test connect if status and brokerages passed
  if (statusResult && brokeragesResult && brokeragesResult.brokerages) {
    await testConnectEndpoint();
  }
  
  console.log('\n===== TEST COMPLETE =====');
}

// Run the tests
runTests();