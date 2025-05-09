import { executeScreener } from './server/pythonExecutionService.js';

async function testScreenerExecution() {
  console.log('Testing Python screener execution...');
  
  const testScreener = {
    id: 99999, // Test ID
    name: 'Test Simple Screener',
    type: 'python',
    source: {
      type: 'file',
      content: './docs/examples/test_simplest_screener.py'
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