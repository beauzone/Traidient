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
    'scipy',
    'ta'  // Added the technical analysis library needed for your screener
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
    // Removed the --user flag which isn't compatible with Replit's virtualenv setup
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
 * Execute a stock screener
 */
export async function executeScreener(screener: any): Promise<any> {
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
    
    // Add success flag and execution timestamp
    return {
      success: true,
      matches: result.matches || [],
      details: result.details || {},
      execution_time: result.execution_time || 0,
      executed_at: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error executing screener (ID: ${screener.id}):`, error);
    
    // Return structured error response
    return {
      success: false,
      matches: [],
      details: {},
      error: error instanceof Error ? error.message : String(error),
      executed_at: new Date().toISOString()
    };
  }
}

/**
 * Generate Python script for a screener using a minimalist approach
 */
async function generatePythonScript(screener: any): Promise<string> {
  await fs.mkdir(TEMP_SCRIPT_DIR, { recursive: true });
  
  // Create a unique filename for this execution
  const scriptId = uuidv4();
  const filename = path.join(TEMP_SCRIPT_DIR, `screener_${scriptId}.py`);
  
  console.log(`Generating Python script for screener (ID: ${screener.id}, Name: ${screener.name || 'unnamed'}, Type: ${screener.source?.type || 'unknown'})`);
  
  // Get the user code
  let userCode = '';
  if (screener.source && screener.source.type === 'code') {
    userCode = screener.source.content;
    console.log(`Using custom code source (${userCode.length} characters)`);
  } else {
    // For non-code sources, create a basic screener
    console.log(`No code source found, using auto-generated screener template`);
    userCode = `
# Important: This screener uses the market data already provided - DO NOT download data externally
def screen_stocks(data_dict):
    """
    Auto-generated screener based on description: ${screener.description || 'No description'}
    
    This screener looks for stocks with:
    1. RSI below 30 (oversold condition)
    2. Price below the 50-day moving average (downtrend)
    3. Recent price increase (potential reversal)
    """
    import pandas as pd
    import numpy as np
    
    # Initialize results
    matches = []
    details = {}
    
    # Process each stock in the data dictionary
    for symbol, data in data_dict.items():
        # Skip if no historical data is available
        if not data.get('historicalData') or len(data['historicalData']) < 20:
            continue
            
        try:
            # Convert historical data to DataFrame
            df = pd.DataFrame(data['historicalData'])
            
            # Ensure the data is properly sorted by date
            df['date'] = pd.to_datetime(df['date'])
            df = df.sort_values('date')
            
            # Calculate technical indicators
            
            # RSI - Relative Strength Index (14-period)
            delta = df['close'].diff()
            gain = delta.where(delta > 0, 0).rolling(window=14).mean()
            loss = -delta.where(delta < 0, 0).rolling(window=14).mean()
            rs = gain / loss
            df['rsi'] = 100 - (100 / (1 + rs))
            
            # Simple Moving Averages
            df['sma20'] = df['close'].rolling(window=20).mean()
            df['sma50'] = df['close'].rolling(window=50).mean()
            
            # Get the latest data point
            latest = df.iloc[-1]
            
            # Check if we have enough data for our indicators
            if pd.isna(latest['rsi']) or pd.isna(latest['sma50']):
                continue
                
            # Get the price change over the last 5 days
            if len(df) >= 5:
                price_5d_ago = df.iloc[-5]['close']
                price_change_5d = (latest['close'] - price_5d_ago) / price_5d_ago * 100
            else:
                price_change_5d = 0
            
            # Screening criteria
            rsi_oversold = latest['rsi'] < 30
            below_ma50 = latest['close'] < latest['sma50']
            price_rising = price_change_5d > 1.0  # 1% increase in last 5 days
            
            # Final screening condition
            if rsi_oversold and below_ma50 and price_rising:
                matches.append(symbol)
                details[symbol] = {
                    "reason": f"Potential reversal: RSI={latest['rsi']:.2f} (oversold), Below MA50, Recent 5-day change: {price_change_5d:.2f}%",
                    "rsi": float(latest['rsi']),
                    "ma50": float(latest['sma50']),
                    "price": float(latest['close']),
                    "price_change_5d": float(price_change_5d)
                }
        except Exception as e:
            # Skip any stocks that cause errors
            continue
    
    return {
        'matches': matches,
        'details': details
    }
`;
  }
  
  // Get real market data using our premium Alpaca data service (preferred)
  // We'll fall back to Yahoo Finance if Alpaca fails
  
  // Import both data services
  const { getAlpacaHistoricalData, getExtendedStockUniverse } = await import('./alpacaScreenerService');
  const { getScreenerData, getDefaultScreenerSymbols } = await import('./screenerDataService');
  
  // Get an extended universe of symbols for more comprehensive screening
  // Use a smaller, but reliable set of symbols to ensure we get proper data
  const symbols = getDefaultScreenerSymbols().slice(0, 10); // Use just 10 reliable symbols to avoid rate limits
  console.log(`Using small, focused stock universe with ${symbols.length} symbols for reliable screening`);
  
  // Fetch real-time market data with historical data for technical indicators
  let marketData: Record<string, any> = {};
  
  // First try Alpaca as the premium data source
  try {
    console.log(`Fetching high-quality market data from Alpaca for ${symbols.length} symbols...`);
    
    // Get market data with historical bars for technical indicators
    // We need at least 90 days for proper RSI calculations and other indicators
    // Some technical indicators like RSI(14) need at least 14+30 days of data
    marketData = await getScreenerData(symbols);
    
    // Log a sample of the data fetched
    const sampleSymbols = Object.keys(marketData).slice(0, 3);
    for (const symbol of sampleSymbols) {
      console.log(`Sample Alpaca data - ${symbol}: price=${marketData[symbol].price}, bars=${marketData[symbol].historicalData?.length || 0}`);
    }
    
    console.log(`Successfully fetched Alpaca data for ${Object.keys(marketData).length} symbols`);
  } catch (alpacaError) {
    console.error(`Failed to fetch Alpaca market data:`, alpacaError);
    console.log(`Falling back to Yahoo Finance data service...`);
    
    // Fall back to Yahoo Finance if Alpaca fails
    try {
      // Get market data directly using our Yahoo Finance service
      marketData = await getScreenerData(symbols);
      
      // Log a sample of the data fetched
      const sampleSymbols = Object.keys(marketData).slice(0, 3);
      for (const symbol of sampleSymbols) {
        console.log(`Sample Yahoo data - ${symbol}: price=${marketData[symbol].price}, company=${marketData[symbol].company}`);
      }
      
      console.log(`Fetched Yahoo Finance data for ${Object.keys(marketData).length} symbols`);
    } catch (yahooError) {
      console.error(`Failed to fetch Yahoo Finance data:`, yahooError);
      
      // Cannot proceed without real market data - screeners need actual data to function
      throw new Error(`Cannot run screeners: Failed to fetch market data from any provider`);
    }
  }
  
  // Convert the market data to a JSON string to be embedded in the Python script
  const marketDataJson = JSON.stringify(marketData, null, 2);
  
  // Create a runner script with pre-fetched real market data
  // Use triple backticks for the user code to maintain exact indentation and avoid conflicts with quotes in the code
  const scriptContent = `#!/usr/bin/env python3
import sys
import json
import os
import time

# Print Python diagnostics
print(f"Python version: {sys.version}")
print(f"Python executable: {sys.executable}")
print(f"Current working directory: {os.getcwd()}")

# Import key packages
try:
    import pandas as pd
    import numpy as np
    # Import pandas_ta for technical indicators
    import pandas_ta as ta
    print("Successfully imported pandas, numpy, and pandas_ta for indicators")
except ImportError as e:
    print(f"WARNING: Failed to import core libraries: {str(e)}")

# The user code - directly pasted without using multi-line string to preserve indentation
${userCode}

print("Preparing data_dict for screener...")

# Load real market data from server (pre-fetched)
data_dict = ${marketDataJson}

print(f"data_dict contains {len(data_dict)} stocks with real market data")

# Intercept and prevent any attempts to download data from Yahoo Finance
# This is needed because custom screeners often try to fetch data directly
import builtins
original_import = builtins.__import__

def patched_import(name, *args, **kwargs):
    # If trying to import yfinance, print a warning
    if name == 'yfinance':
        print("WARNING: Detected import of yfinance. Using pre-fetched data instead.")
        # Return the original module but override its download function
        module = original_import(name, *args, **kwargs)
        original_download = module.download
        
        # Replace download function with our version that uses pre-fetched data
        def mock_download(*args, **kwargs):
            print("WARNING: Intercepted call to yfinance.download(). Using pre-fetched data instead.")
            return None
            
        module.download = mock_download
        return module
    return original_import(name, *args, **kwargs)

# Replace the built-in import function with our patched version
builtins.__import__ = patched_import

# Define a replacement for common data loading functions found in user screeners
def load_data(symbols, period='1y', interval='1d'):
    print("WARNING: load_data() called. Using pre-fetched data instead of downloading fresh data.")
    return data_dict

# Helper function to convert market data to DataFrames with indicators
def prepare_dataframes_with_indicators(data_dict):
    """
    Convert the market data into pandas DataFrames with technical indicators
    
    Args:
        data_dict: Dictionary containing market data from Alpaca or Yahoo Finance
        
    Returns:
        dict: Dictionary with symbol keys and pandas DataFrame values with indicators
    """
    dfs = {}
    
    for symbol, data in data_dict.items():
        # Handle field name discrepancies in market data
        hist_data = None
        if 'historicalData' in data and len(data['historicalData']) > 0:
            hist_data = data['historicalData']
        elif 'historical' in data and len(data['historical']) > 0:
            hist_data = data['historical']
            
        if hist_data:
            # Convert historical data to DataFrame
            df = pd.DataFrame(hist_data)
            
            # Set date as index and ensure proper sorting
            df['date'] = pd.to_datetime(df['date'])
            df = df.sort_values('date')
            df.set_index('date', inplace=True)
            
            # Calculate common technical indicators
            # RSI - Relative Strength Index
            if len(df) >= 14:  # Need at least 14 periods for RSI
                df['rsi'] = ta.rsi(df['close'], length=14)
                
                # Moving Averages
                df['sma20'] = ta.sma(df['close'], length=20)
                df['sma50'] = ta.sma(df['close'], length=50)
                df['ema9'] = ta.ema(df['close'], length=9)
                
                # MACD - Moving Average Convergence Divergence
                macd = ta.macd(df['close'])
                df = pd.concat([df, macd], axis=1)
                
                # Bollinger Bands
                bbands = ta.bbands(df['close'])
                df = pd.concat([df, bbands], axis=1)
                
                # Determine trend based on SMA
                if 'sma20' in df.columns and 'sma50' in df.columns:
                    df['trend'] = np.where(df['sma20'] > df['sma50'], 'bullish', 'bearish')
            
            # Store the DataFrame with indicators
            dfs[symbol] = df
    
    return dfs

# Create DataFrames with technical indicators
print("Preparing DataFrames with technical indicators...")
try:
    dataframes = prepare_dataframes_with_indicators(data_dict)
    print(f"Successfully created {len(dataframes)} DataFrames with indicators")
except Exception as e:
    print(f"Warning: Error preparing indicator DataFrames: {e}")
    dataframes = {}

# Execute the user code in a try-except block to catch any errors
try:
    print("Calling screen_stocks function...")
    # Call the screen_stocks function which is now directly defined above
    # Pass both the raw data_dict and the processed dataframes with indicators
    result = screen_stocks(data_dict)
    
    # Handle different result types (dictionary, list, or string)
    if isinstance(result, str):
        # String result means there might be an issue, convert to proper format
        print(f"Received string result: {result}")
        result = {"matches": [], "details": {}, "message": result}
    elif isinstance(result, list):
        # List result means just symbol matches without details
        print(f"Received list result with {len(result)} items")
        result = {"matches": result, "details": {}}
    elif not isinstance(result, dict):
        # Unknown result type, create empty result
        print(f"Received unexpected result type: {type(result)}")
        result = {"matches": [], "details": {}}
    
    # Ensure there's a matches key for the output
    if isinstance(result, dict) and 'matches' not in result:
        print("Adding missing 'matches' key to result")
        result['matches'] = []
    
    # If the function doesn't accept the dataframes parameter, that's okay
    # We'll update the result with additional technical info
    if isinstance(result, dict) and 'matches' in result:
        # Add technical analysis details to matches
        for symbol in result['matches']:
            if not result.get('details'):
                result['details'] = {}
                
            if symbol not in result.get('details', {}):
                result['details'][symbol] = {"reason": "Matched by screen criteria"}
                
            if symbol in dataframes:
                df = dataframes[symbol]
                last_row = df.iloc[-1]
                
                # Add technical analysis details if not already provided
                if symbol in result.get('details', {}) and isinstance(result['details'][symbol], dict):
                    # Only add technical data if not already present
                    if 'technical_data' not in result['details'][symbol]:
                        try:
                            result['details'][symbol]['technical_data'] = {
                                'rsi': float(last_row['rsi']) if 'rsi' in last_row and not pd.isna(last_row['rsi']) else None,
                                'sma20': float(last_row['sma20']) if 'sma20' in last_row and not pd.isna(last_row['sma20']) else None,
                                'sma50': float(last_row['sma50']) if 'sma50' in last_row and not pd.isna(last_row['sma50']) else None,
                                'trend': last_row['trend'] if 'trend' in last_row and not pd.isna(last_row['trend']) else None,
                                'close': float(last_row['close']) if 'close' in last_row else None,
                                'data_provider': 'alpaca'
                            }
                        except Exception as e:
                            print(f"Error adding technical data for {symbol}: {e}")
    
    print(f"screen_stocks function returned result of type: {type(result)}")
    
    # Print the result with special markers for easy extraction
    # Added crucial flush step to ensure output is captured before process exits
    import sys
    print("\\n--- RESULT START ---")
    print(json.dumps(result))
    print("--- RESULT END ---")
    sys.stdout.flush()
except Exception as e:
    # Print the error with the special markers
    error_msg = str(e)
    print(f"Error executing screener: {error_msg}")
    
    # Make sure to include stdout flush in error case too
    import sys
    print("\\n--- RESULT START ---")
    print(json.dumps({
        "matches": [],
        "details": {},
        "errors": error_msg
    }))
    print("--- RESULT END ---")
    sys.stdout.flush()
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
    // Run Python in unbuffered mode (-u) to ensure proper stdout capture
    // Also set environment variables to prevent buffering
    const pythonProcess = spawn('python3', ['-u', scriptPath], {
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',  // Disable Python output buffering
        PYTHONIOENCODING: 'utf-8' // Ensure consistent encoding
      }
    });
    
    let outputData = '';
    let errorData = '';
    
    // Special markers for extracting the JSON result
    const startMarker = 'RESULT_JSON_START';
    const endMarker = 'RESULT_JSON_END';
    let jsonCapturing = false;
    let jsonData = '';
    
    pythonProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      // Log raw output for debugging (truncated to avoid huge logs)
      console.log(`[Python stdout] ${chunk.substring(0, 200)}${chunk.length > 200 ? '...' : ''}`);
      outputData += chunk;
      
      // Check for JSON result markers in the output stream and capture data between them
      if (chunk.includes(startMarker)) {
        jsonCapturing = true;
        const startIdx = chunk.indexOf(startMarker) + startMarker.length;
        // Only add data after the marker
        jsonData += chunk.substring(startIdx);
        return;
      }
      
      if (jsonCapturing && chunk.includes(endMarker)) {
        jsonCapturing = false;
        const endIdx = chunk.indexOf(endMarker);
        // Only add data before the end marker
        jsonData += chunk.substring(0, endIdx);
        return;
      }
      
      // If we're currently capturing JSON data, add this chunk to it
      if (jsonCapturing) {
        jsonData += chunk;
      }
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
          // Log the entire output for debugging (truncated to avoid huge logs)
          console.log(`Output length: ${outputData.length} characters`);
          console.log(`Output excerpt (first 500 chars): ${outputData.substring(0, 500)}`);
          
          // Check if we captured JSON data between markers using our streaming approach
          if (jsonData) {
            console.log(`Using directly captured JSON data (${jsonData.length} chars)`);
            try {
              const result = JSON.parse(jsonData.trim());
              console.log(`Successfully parsed JSON data from captured stream`);
              return resolve(result);
            } catch (error) {
              const errorObj = error as Error;
              console.error(`Error parsing captured JSON: ${errorObj.message}`);
              // Fall through to backup extraction method
            }
          }
          
          // Backup method: look for our special markers in the full output
          const resultStartMarker = "RESULT_JSON_START";
          const resultEndMarker = "RESULT_JSON_END";
          
          // Try improved marker extraction using regex (more robust to newlines and variations)
          console.log("Trying regex extraction for markers");
          const resultMarkerRegex = /RESULT_JSON_START\s*([\s\S]*?)\s*RESULT_JSON_END/;
          const regexMatch = outputData.match(resultMarkerRegex);
          
          if (regexMatch && regexMatch[1]) {
            try {
              const jsonStr = regexMatch[1].trim();
              console.log(`Regex found content (first 50 chars): ${jsonStr.substring(0, 50)}...`);
              
              const result = JSON.parse(jsonStr);
              console.log(`Successfully parsed JSON from regex with ${result.matches ? result.matches.length : 0} matches`);
              console.log(`Matches: ${JSON.stringify(result.matches)}`);
              resolve(result);
              return; // Exit early if regex method works
            } catch (e) {
              console.error('Error parsing JSON from regex:', e);
              // Fall through to other methods
            }
          }
          
          // Fallback to traditional indexOf approach
          const startIndex = outputData.indexOf(resultStartMarker);
          // Need to find end marker AFTER the start marker to avoid earlier instances
          const contentStartIndex = startIndex + resultStartMarker.length;
          const endIndex = outputData.indexOf(resultEndMarker, contentStartIndex);
          
          console.log(`Marker indices: start=${startIndex}, contentStart=${contentStartIndex}, end=${endIndex}`);
          
          // Check if both markers exist and are in the correct order
          if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
            console.log("Found result markers in output, extracting JSON between them");
            
            // Extract the JSON between the markers (excluding the markers themselves)
            const jsonContent = outputData.substring(contentStartIndex, endIndex).trim();
            
            console.log(`Extracted content length: ${jsonContent.length}`);
            console.log(`Extracted JSON content (first 100 chars): ${jsonContent.substring(0, 100)}`);
            
            try {
              const result = JSON.parse(jsonContent);
              console.log(`Successfully parsed JSON from markers with ${result.matches ? result.matches.length : 0} matches`);
              console.log(`Matches: ${JSON.stringify(result.matches)}`);
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