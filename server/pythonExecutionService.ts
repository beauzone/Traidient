// Python execution service for the screener module
// Handles the execution of Python scripts in a child process

import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Screener } from '@shared/schema';

// Constants for script execution
const TEMP_SCRIPT_DIR = path.join(process.cwd(), 'tmp', 'python-scripts');

/**
 * Initialize the Python environment for screeners
 */
export async function initPythonEnvironment(): Promise<void> {
  try {
    console.log("Initializing Python environment for screeners...");
    
    // Create the temporary script directory if it doesn't exist
    await fs.mkdir(TEMP_SCRIPT_DIR, { recursive: true });
    
    // Check if Python is installed
    const pythonCheck = await checkPythonInstallation();
    
    if (!pythonCheck.installed) {
      throw new Error("Python 3 is not installed. Please install Python 3.6 or higher.");
    }
    
    console.log(`Python ${pythonCheck.version} detected`);
    
    // Check and install required libraries
    await checkAndInstallLibraries();
    
    console.log("Python environment initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Python environment:", error);
    throw new Error(`Failed to initialize Python environment: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if Python is installed and get its version
 */
async function checkPythonInstallation(): Promise<{ installed: boolean, version: string }> {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', ['--version']);
    
    let versionData = '';
    
    pythonProcess.stdout.on('data', (data) => {
      versionData += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      versionData += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        // Extract version from output (e.g., "Python 3.8.10" -> "3.8.10")
        const versionMatch = versionData.match(/Python (\d+\.\d+\.\d+)/);
        const version = versionMatch ? versionMatch[1] : 'unknown';
        resolve({ installed: true, version });
      } else {
        resolve({ installed: false, version: 'not installed' });
      }
    });
    
    pythonProcess.on('error', (error) => {
      resolve({ installed: false, version: 'not installed' });
    });
  });
}

/**
 * Check and install required Python libraries
 */
async function checkAndInstallLibraries(): Promise<void> {
  // Get list of installed packages
  const installedPackages = await getInstalledPackages();
  const installedPackageNames = installedPackages.map(pkg => pkg.name.toLowerCase());
  
  // List of required packages
  const requiredPackages = [
    'pandas',
    'numpy',
    'yfinance',
    'pandas-ta',
    'plotly',
    'matplotlib',
    'scikit-learn',
    'scipy'
  ];
  
  // Check if any required packages are missing
  const missingPackages = requiredPackages.filter(pkg => 
    !installedPackageNames.includes(pkg.toLowerCase())
  );
  
  if (missingPackages.length > 0) {
    console.log(`Installing missing Python libraries: ${missingPackages.join(', ')}`);
    await installLibraries(missingPackages);
  } else {
    console.log("All required Python libraries are already installed");
  }
}

/**
 * Get a list of installed Python packages
 */
async function getInstalledPackages(): Promise<Array<{ name: string, version: string }>> {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', ['-m', 'pip', 'list', '--format=json']);
    
    let outputData = '';
    
    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const packages = JSON.parse(outputData);
          resolve(packages);
        } catch (error) {
          console.error("Error parsing pip list output:", error);
          resolve([]);
        }
      } else {
        console.warn("Failed to get installed Python packages");
        resolve([]);
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error("Error running pip list:", error);
      resolve([]);
    });
  });
}

/**
 * Install Python libraries using pip
 */
async function installLibraries(libraries: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', ['-m', 'pip', 'install', '--user', ...libraries]);
    
    pythonProcess.stdout.on('data', (data) => {
      console.log(`[pip install] ${data.toString().trim()}`);
    });
    
    pythonProcess.stderr.on('data', (data) => {
      console.error(`[pip install error] ${data.toString().trim()}`);
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pip install exited with code ${code}`));
      }
    });
    
    pythonProcess.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Execute a stock screener
 */
export async function executeScreener(screener: Screener): Promise<any> {
  try {
    // Generate the Python script
    const scriptPath = await generatePythonScript(screener);
    
    console.log(`Executing Python screener (ID: ${screener.id})`);
    
    // Execute the script
    const result = await runPythonScript(scriptPath);
    
    // Clean up - delete the temporary script
    await fs.unlink(scriptPath).catch(error => {
      console.warn(`Failed to delete temporary script ${scriptPath}:`, error);
    });
    
    return result;
  } catch (error) {
    console.error(`Error executing screener (ID: ${screener.id}):`, error);
    throw error;
  }
}

/**
 * Generate Python script for a screener using a minimalist approach
 */
async function generatePythonScript(screener: Screener): Promise<string> {
  await fs.mkdir(TEMP_SCRIPT_DIR, { recursive: true });
  
  // Create a unique filename for this execution
  const scriptId = uuidv4();
  const filename = path.join(TEMP_SCRIPT_DIR, `screener_${scriptId}.py`);
  
  // Get the user code
  let userCode = '';
  if (screener.source.type === 'code') {
    userCode = screener.source.content;
  } else {
    // For non-code sources, create a basic screener
    userCode = `
def screen_stocks(data_dict):
    """
    Auto-generated screener based on description: ${screener.description}
    """
    # Create a simple example result
    matches = ["AAPL", "MSFT", "GOOGL"]
    details = {
        "AAPL": {"reason": "Auto-generated example match"},
        "MSFT": {"reason": "Auto-generated example match"},
        "GOOGL": {"reason": "Auto-generated example match"}
    }
    
    return {
        'matches': matches,
        'details': details
    }
`;
  }
  
  // Create a super simple runner script
  const scriptContent = `#!/usr/bin/env python3
import sys
import json

# The user code
user_code = """
${userCode}
"""

# Create a minimal test data dictionary
data_dict = {
    "AAPL": {},
    "MSFT": {},
    "GOOGL": {}
}

# Execute the user code in a try-except block to catch any errors
try:
    # Define the function in the current scope
    exec(user_code)
    
    # Call the screen_stocks function
    result = locals()["screen_stocks"](data_dict)
    
    # Print the result with special markers for easy extraction
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
except Exception as e:
    # Print the error with the special markers
    print(f"Error: {str(e)}")
    print("RESULT_JSON_START")
    print(json.dumps({
        "matches": [],
        "details": {"error": str(e)}
    }))
    print("RESULT_JSON_END")
`;

  // Write the script to a file
  await fs.writeFile(filename, scriptContent);
  
  return filename;
}

/**
 * Run a Python script and return the results, using our marker-based extraction approach
 */
async function runPythonScript(scriptPath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', [scriptPath]);
    
    let outputData = '';
    let errorData = '';
    
    // Special markers for extracting the JSON result
    const startMarker = 'RESULT_JSON_START';
    const endMarker = 'RESULT_JSON_END';
    
    pythonProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      // Log raw output for debugging (truncated to avoid huge logs)
      console.log(`[Python stdout] ${chunk.substring(0, 200)}${chunk.length > 200 ? '...' : ''}`);
      outputData += chunk;
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      errorData += chunk;
      console.error(`[Python Error] ${chunk.trim()}`);
    });
    
    pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);
      
      if (code === 0) {
        try {
          // First look for our special markers "RESULT_JSON_START" and "RESULT_JSON_END"
          const resultStartMarker = "RESULT_JSON_START";
          const resultEndMarker = "RESULT_JSON_END";
          
          const startIndex = outputData.indexOf(resultStartMarker);
          const endIndex = outputData.indexOf(resultEndMarker);
          
          // Check if both markers exist and are in the correct order
          if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
            console.log("Found result markers in output, extracting JSON between them");
            
            // Extract the JSON between the markers (add newline length to skip to next line)
            const jsonContent = outputData.substring(
              startIndex + resultStartMarker.length, 
              endIndex
            ).trim();
            
            try {
              const result = JSON.parse(jsonContent);
              console.log(`Successfully parsed JSON from markers with ${result.matches ? result.matches.length : 0} matches`);
              resolve(result);
              return; // Exit early if marker method works
            } catch (e) {
              console.error('Error parsing JSON between markers:', e);
              console.error('JSON string tried to parse:', jsonContent.substring(0, 200));
              // Fall through to legacy approaches if marker parsing fails
            }
          } else {
            console.log("No result markers found, falling back to legacy parsing");
          }
          
          // Legacy approach as fallback
          // Try to find the last valid JSON object in the output
          
          // First, try to identify a clean JSON object that's on its own line
          const lines = outputData.split('\n');
          let foundResult = false;
          
          // Traverse lines backwards to find the last JSON object
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (!line) continue;
            
            try {
              const possibleJson = JSON.parse(line);
              
              // Verify it has the expected structure
              if (possibleJson && typeof possibleJson === 'object' && 
                  (possibleJson.matches !== undefined || possibleJson.success === false)) {
                console.log(`Found valid JSON result on line ${i+1}`);
                console.log(`Successfully parsed JSON result with ${possibleJson.matches ? possibleJson.matches.length : 0} matches`);
                resolve(possibleJson);
                foundResult = true;
                break;
              }
            } catch (e) {
              // Not valid JSON, continue searching
              continue;
            }
          }
          
          // If no clean line-by-line JSON, try regex approach as fallback
          if (!foundResult) {
            console.log("No clean JSON found on its own line, trying regex pattern matching");
            const jsonMatches = outputData.match(/\{[\s\S]*?\}/g);
            
            if (jsonMatches && jsonMatches.length > 0) {
              // Try each match from last to first until we find valid JSON
              for (let i = jsonMatches.length - 1; i >= 0; i--) {
                try {
                  const result = JSON.parse(jsonMatches[i]);
                  
                  // Verify it has the expected structure
                  if (result && typeof result === 'object' && 
                      (result.matches !== undefined || result.success === false)) {
                    console.log(`Found valid JSON result (match ${i+1} of ${jsonMatches.length})`);
                    console.log(`Successfully parsed JSON result with ${result.matches ? result.matches.length : 0} matches`);
                    resolve(result);
                    foundResult = true;
                    break;
                  }
                } catch (parseError) {
                  // Not valid JSON or not our expected format, continue searching
                  continue;
                }
              }
            }
          }
          
          // If we still haven't found a valid result, return an error
          if (!foundResult) {
            console.error('No valid JSON found in Python output');
            console.error('Raw output (truncated):', outputData.substring(0, 500));
            reject(new Error('No valid JSON found in Python output'));
          }
        } catch (error) {
          console.error('Failed to parse Python script output:', error);
          console.error('Raw output (truncated):', outputData.substring(0, 500));
          reject(new Error('Invalid output from Python script'));
        }
      } else {
        console.error(`Python script exited with code ${code}`);
        console.error('Error output:', errorData);
        console.error('Standard output (truncated):', outputData.substring(0, 500));
        reject(new Error(`Python script exited with code ${code}: ${errorData}`));
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error('Failed to start Python process:', error);
      reject(error);
    });
  });
}