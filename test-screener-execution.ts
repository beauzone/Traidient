import { executeScreener } from './server/pythonExecutionService';

async function testScreenerExecution() {
  console.log('Testing Python screener execution...');
  
  const testScreener = {
    id: 99999, // Test ID
    name: 'Test Simple Screener',
    type: 'python',
    source: {
      type: 'code',
      content: `
import json
import sys

def screen_stocks(data_dict):
    """
    The simplest possible screener that just returns a fixed result.
    Using the proper marker approach with stdout flushing.
    """
    print("Running absolute minimal test screener")
    
    # Static test data
    matches = ["AAPL", "MSFT", "GOOG"]
    details = {
        "AAPL": {"price": 190.25, "reason": "Test match"},
        "MSFT": {"price": 415.78, "reason": "Test match"},
        "GOOG": {"price": 180.45, "reason": "Test match"}
    }
    
    # Prepare result
    result = {
        'matches': matches,
        'details': details,
        'errors': None
    }
    
    # Print result with markers AND flush stdout
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    sys.stdout.flush()  # CRUCIAL: ensures output is captured before process exits
    
    return result
`
    },
    configuration: {
      parameters: {}
    }
  };
  
  try {
    console.log('Running screener...');
    const result = await executeScreener(testScreener);
    console.log('Screener execution result:');
    console.log(JSON.stringify(result, null, 2));
    console.log(`Found ${result.matches ? result.matches.length : 0} matches`);
    
    if (result.matches && result.matches.length > 0) {
      console.log('SUCCESS: Screener returned matches as expected!');
    } else {
      console.log('ERROR: Screener returned no matches!');
    }
  } catch (error) {
    console.error('Failed to execute screener:', error);
  }
}

testScreenerExecution().catch(console.error);