/**
 * Enhanced Python Execution Service
 * This service handles the execution of Python screeners in a clean, isolated environment
 * with proper input/output capturing and error handling
 */

import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Constants for script execution
const TEMP_SCRIPT_DIR = path.join(process.cwd(), 'tmp', 'python-scripts');
const EXECUTION_TIMEOUT = 60000; // 60 seconds max execution time

export class PythonExecutionService {
  private isInitialized: boolean = false;
  private pythonVersion: string = '';
  
  /**
   * Create a new Python execution service instance
   */
  constructor() {
    // We'll initialize on demand when needed
  }
  
  /**
   * Initialize the Python environment
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    try {
      console.log("Initializing Python environment for screeners...");
      
      // Create the temporary script directory if it doesn't exist
      await fs.mkdir(TEMP_SCRIPT_DIR, { recursive: true });
      
      // Check if Python is installed
      const pythonCheck = await this.checkPythonInstallation();
      
      if (!pythonCheck.installed) {
        throw new Error("Python 3 is not installed. Please install Python 3.6 or higher.");
      }
      
      console.log(`Python ${pythonCheck.version} detected`);
      this.pythonVersion = pythonCheck.version;
      
      // Check and install required libraries
      await this.checkAndInstallLibraries();
      
      console.log("Python environment initialized successfully");
      this.isInitialized = true;
    } catch (error) {
      console.error("Failed to initialize Python environment:", error);
      throw new Error(`Failed to initialize Python environment: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Execute a Python screener with the given code and data
   */
  async executeScreener(code: string, data: Record<string, any>): Promise<any> {
    // Make sure we've initialized
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      // Generate a temporary script file
      const scriptPath = await this.generatePythonScript(code, data);
      
      // Execute the script
      const result = await this.runPythonScript(scriptPath);
      
      // Clean up the temporary script
      await fs.unlink(scriptPath).catch(error => {
        console.warn(`Failed to delete temporary script ${scriptPath}:`, error);
      });
      
      return result;
    } catch (error) {
      console.error("Error executing Python screener:", error);
      throw error;
    }
  }
  
  /**
   * Check if Python is installed and get its version
   */
  private async checkPythonInstallation(): Promise<{ installed: boolean, version: string }> {
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
  private async checkAndInstallLibraries(): Promise<void> {
    // Get list of installed packages
    const installedPackages = await this.getInstalledPackages();
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
      'scipy',
      'ta'  // Technical analysis library
    ];
    
    // Check if any required packages are missing
    const missingPackages = requiredPackages.filter(pkg => 
      !installedPackageNames.includes(pkg.toLowerCase())
    );
    
    if (missingPackages.length > 0) {
      console.log(`Installing missing Python libraries: ${missingPackages.join(', ')}`);
      await this.installLibraries(missingPackages);
    } else {
      console.log("All required Python libraries are already installed");
    }
  }
  
  /**
   * Get a list of installed Python packages
   */
  private async getInstalledPackages(): Promise<Array<{ name: string, version: string }>> {
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
  private async installLibraries(libraries: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', ['-m', 'pip', 'install', ...libraries]);
      
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
   * Generate a Python script for a screener
   */
  private async generatePythonScript(code: string, data: Record<string, any>): Promise<string> {
    await fs.mkdir(TEMP_SCRIPT_DIR, { recursive: true });
    
    // Create a unique filename for this execution
    const scriptId = uuidv4();
    const filename = path.join(TEMP_SCRIPT_DIR, `screener_${scriptId}.py`);
    
    // Convert the market data to a JSON string to be embedded in the Python script
    const marketDataJson = JSON.stringify(data, null, 2);
    
    // Create a runner script with pre-fetched real market data
    const scriptContent = `#!/usr/bin/env python3
import sys
import json
import os
import time
import traceback

# Start timing execution
start_time = time.time()

# Print Python diagnostics
print(f"Python version: {sys.version}")
print(f"Current working directory: {os.getcwd()}")

# Setup result markers for reliable output parsing
print("###EXECUTION_START###")

# Import key packages
try:
    import pandas as pd
    import numpy as np
    # Import pandas_ta for technical indicators
    import pandas_ta as ta
except ImportError as e:
    print(f"ERROR: Failed to import core libraries: {str(e)}")
    print("###EXECUTION_ERROR###")
    print(json.dumps({
        "error": f"Failed to import required libraries: {str(e)}",
        "execution_time": time.time() - start_time
    }))
    sys.exit(1)

# The user-provided screener code
${code}

# Load market data (pre-fetched from server)
data_dict = json.loads('''${marketDataJson}''')

print(f"Loaded data for {len(data_dict)} symbols")

# Run the screener
try:
    # Call the screen_stocks function which should be defined in the user code
    if 'screen_stocks' in globals():
        result = screen_stocks(data_dict)
        if not isinstance(result, dict):
            result = {"matches": [], "error": "Screener function did not return a dictionary"}
    else:
        # Try to find a function that might be the screener
        screener_func = None
        for func_name in globals():
            if callable(globals()[func_name]) and func_name.lower().find('screen') >= 0:
                screener_func = globals()[func_name]
                break
        
        if screener_func:
            result = screener_func(data_dict)
            if not isinstance(result, dict):
                result = {"matches": [], "error": f"Screener function {func_name} did not return a dictionary"}
        else:
            result = {"matches": [], "error": "No 'screen_stocks' function found in the screener code"}
    
    # Add execution time
    result['execution_time'] = time.time() - start_time
    
    # Ensure result is JSON serializable
    if 'matches' in result and isinstance(result['matches'], list):
        # Convert any non-serializable values to strings
        if 'details' in result and isinstance(result['details'], dict):
            for symbol, details in result['details'].items():
                if isinstance(details, dict):
                    for key, value in list(details.items()):
                        if not isinstance(value, (str, int, float, bool, type(None))):
                            details[key] = str(value)
    
    # Print the result with a marker for reliable parsing
    print("###EXECUTION_RESULT###")
    print(json.dumps(result))
    
except Exception as e:
    error_traceback = traceback.format_exc()
    print(f"ERROR: {str(e)}\\n{error_traceback}")
    print("###EXECUTION_ERROR###")
    print(json.dumps({
        "error": str(e),
        "traceback": error_traceback,
        "matches": [],
        "execution_time": time.time() - start_time
    }))

# End marker for reliable parsing
print("###EXECUTION_END###")
`;
    
    // Write the script to the file
    await fs.writeFile(filename, scriptContent, 'utf8');
    
    return filename;
  }
  
  /**
   * Run a Python script and parse the output
   */
  private async runPythonScript(scriptPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      let executionTimedOut = false;
      const timeout = setTimeout(() => {
        executionTimedOut = true;
        pythonProcess.kill();
        reject(new Error(`Python script execution timed out after ${EXECUTION_TIMEOUT / 1000} seconds`));
      }, EXECUTION_TIMEOUT);
      
      const pythonProcess = spawn('python3', [scriptPath]);
      
      let stdoutData = '';
      let stderrData = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        clearTimeout(timeout);
        
        if (executionTimedOut) {
          return; // Already rejected
        }
        
        if (code !== 0) {
          console.error(`Python script exited with code ${code}`);
          console.error(`STDERR: ${stderrData}`);
          
          return reject(new Error(`Python script exited with code ${code}: ${stderrData}`));
        }
        
        try {
          // Extract execution result using markers for reliable parsing
          const resultMarker = "###EXECUTION_RESULT###";
          const errorMarker = "###EXECUTION_ERROR###";
          
          let result;
          
          if (stdoutData.includes(errorMarker)) {
            const errorParts = stdoutData.split(errorMarker);
            if (errorParts.length >= 2) {
              const errorJson = errorParts[1].trim().split("\n")[0].trim();
              result = JSON.parse(errorJson);
            } else {
              result = { error: "Error occurred but could not parse error details", matches: [] };
            }
          } else if (stdoutData.includes(resultMarker)) {
            const resultParts = stdoutData.split(resultMarker);
            if (resultParts.length >= 2) {
              const resultJson = resultParts[1].trim().split("\n")[0].trim();
              result = JSON.parse(resultJson);
            } else {
              result = { error: "Result marker found but could not parse result", matches: [] };
            }
          } else {
            console.warn("Could not find execution result markers in Python output");
            result = { 
              error: "Could not parse execution result, missing markers", 
              matches: [],
              stdout: stdoutData,
              stderr: stderrData
            };
          }
          
          resolve(result);
        } catch (error) {
          console.error("Error parsing Python script output:", error);
          console.error(`STDOUT: ${stdoutData}`);
          console.error(`STDERR: ${stderrData}`);
          
          reject(new Error(`Failed to parse Python script output: ${error instanceof Error ? error.message : String(error)}`));
        }
      });
      
      pythonProcess.on('error', (error) => {
        clearTimeout(timeout);
        console.error("Error running Python script:", error);
        reject(error);
      });
    });
  }
}

export async function initPythonEnvironment(): Promise<void> {
  const service = new PythonExecutionService();
  await service.initialize();
}

export default PythonExecutionService;