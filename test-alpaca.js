/**
 * Test script to verify Alpaca API connection and diagnose issues
 */

// No need for dotenv in Replit - environment variables are already loaded

// Log current environment for context
console.log('Executing test in environment:');
console.log(`- NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`- Is Replit: ${process.env.REPL_ID ? 'Yes' : 'No'}`);

// Try to get the Alpaca API keys from environment
const apiKey = process.env.ALPACA_API_KEY;
const apiSecret = process.env.ALPACA_API_SECRET;

// Check if keys exist but don't print them
console.log(`ALPACA_API_KEY exists: ${!!apiKey}`);
console.log(`ALPACA_API_SECRET exists: ${!!apiSecret}`);

if (!apiKey || !apiSecret) {
  console.error('❌ Alpaca API keys are missing from environment variables');
  console.log('Please set ALPACA_API_KEY and ALPACA_API_SECRET environment variables');
  process.exit(1);
}

// Print first/last few characters of keys for verification (without revealing whole key)
console.log(`API Key prefix: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);
console.log(`API Secret prefix: ${apiSecret.substring(0, 4)}...${apiSecret.substring(apiSecret.length - 4)}`);

// Determine which environment to test (paper/live)
const isPaperTrading = true; // Change to false for live trading
const tradingBaseUrl = isPaperTrading 
  ? "https://paper-api.alpaca.markets/v2" 
  : "https://api.alpaca.markets/v2";
const dataBaseUrl = "https://data.alpaca.markets/v2";

console.log(`\nTesting against Alpaca ${isPaperTrading ? 'Paper Trading' : 'Live Trading'} environment`);
console.log(`Trading API URL: ${tradingBaseUrl}`);
console.log(`Data API URL: ${dataBaseUrl}`);

// Function to fetch data from Alpaca API
async function fetchFromAlpaca(endpoint, baseUrl) {
  try {
    console.log(`\nTesting endpoint: ${baseUrl}${endpoint}`);
    
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': apiSecret
      }
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    const contentType = response.headers.get('content-type');
    console.log(`Content-Type: ${contentType}`);
    
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      console.log('Response data:', JSON.stringify(data, null, 2));
      return { success: response.ok, data };
    } else {
      const text = await response.text();
      console.log('Response text:', text);
      return { success: response.ok, text };
    }
  } catch (error) {
    console.error(`Error in request: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Perform a series of tests against different endpoints
async function runTests() {
  console.log('\n🔍 TESTING ALPACA API CONNECTIVITY');
  console.log('================================');
  
  // Test account access (authentication)
  console.log('\n📊 Testing account access (authentication)');
  const accountResult = await fetchFromAlpaca('/account', tradingBaseUrl);
  
  if (accountResult.success) {
    console.log('✅ Account access test PASSED');
  } else {
    console.log('❌ Account access test FAILED');
  }
  
  // Test clock endpoint (usually less restricted)
  console.log('\n⏰ Testing market clock endpoint');
  const clockResult = await fetchFromAlpaca('/clock', tradingBaseUrl);
  
  if (clockResult.success) {
    console.log('✅ Clock endpoint test PASSED');
  } else {
    console.log('❌ Clock endpoint test FAILED');
  }
  
  // Test data API with a quote for AAPL
  console.log('\n💰 Testing market data API with AAPL quote');
  const quoteResult = await fetchFromAlpaca('/stocks/AAPL/quotes/latest', dataBaseUrl);
  
  if (quoteResult.success) {
    console.log('✅ Market data API test PASSED');
  } else {
    console.log('❌ Market data API test FAILED');
  }
  
  // Test data API with bars for AAPL
  console.log('\n📈 Testing market data API with AAPL bars');
  const barsResult = await fetchFromAlpaca('/stocks/bars?symbols=AAPL&timeframe=1Day&limit=5', dataBaseUrl);
  
  if (barsResult.success) {
    console.log('✅ Market bars API test PASSED');
  } else {
    console.log('❌ Market bars API test FAILED');
  }
  
  // Overall conclusion
  console.log('\n📝 TEST SUMMARY');
  console.log('==============');
  
  const passedTests = [
    accountResult.success,
    clockResult.success,
    quoteResult.success,
    barsResult.success
  ].filter(success => success).length;
  
  const totalTests = 4;
  console.log(`Passed ${passedTests} out of ${totalTests} tests`);
  
  if (passedTests === totalTests) {
    console.log('✅ All tests PASSED - Alpaca API is working correctly!');
  } else if (passedTests === 0) {
    console.log('❌ All tests FAILED - Check your API keys or network connection');
    console.log('\nPossible issues:');
    console.log('1. API keys may be invalid or expired');
    console.log('2. API keys may not have sufficient permissions');
    console.log('3. Your network/firewall may be blocking API requests');
    console.log('4. Alpaca servers may be experiencing issues');
  } else {
    console.log('⚠️ Some tests failed - Check detailed results above');
  }
}

// Run the tests
runTests();