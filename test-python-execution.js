// Simple test script for the Python execution service
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { executeScreener, initPythonEnvironment } from './server/pythonExecutionService.ts';

// Get the directory name properly in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testPythonExecution() {
  try {
    console.log("Initializing Python environment...");
    await initPythonEnvironment();
    
    console.log("\nReading test screener file...");
    const screenerCodePath = path.join(__dirname, 'docs', 'examples', 'test_screener.py');
    const screenerCode = await fs.readFile(screenerCodePath, 'utf8');
    
    console.log("Creating test screener object...");
    const testScreener = {
      id: 'test-screener-1',
      name: 'Test Screener',
      description: 'A test screener to verify Python execution',
      source: {
        type: 'code',
        content: screenerCode
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      userId: 1
    };
    
    console.log("\nExecuting test screener...");
    const result = await executeScreener(testScreener);
    
    console.log("\nTest screener execution result:");
    console.log(JSON.stringify(result, null, 2));
    
    console.log("\nTest completed successfully!");
  } catch (error) {
    console.error("Error in test:", error);
  }
}

// Run the test
testPythonExecution();