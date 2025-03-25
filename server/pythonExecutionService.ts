/**
 * Python Execution Service
 * 
 * This service provides functionality to execute Python code for screeners,
 * with support for common financial analysis libraries.
 */
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { Screener } from '@shared/schema';

// Ensure this directory exists
const TEMP_SCRIPT_DIR = './tmp/python_scripts';

// Libraries that should be available for Python screeners
const REQUIRED_LIBRARIES = [
  'pandas',
  'numpy',
  'scipy',
  'matplotlib',
  'ta-lib', // Technical analysis library
  'pandas_ta', // Extended TA functionality integrated with pandas
  'scikit-learn', // For ML-based screening
  'statsmodels', // For statistical analysis
  'yfinance', // For easy data access
  'mplfinance', // For financial chart visualization
  'plotly', // For interactive charts
  'talib-binary', // Binary distribution of TA-Lib
  'alpaca-trade-api' // Alpaca API for market data
];

/**
 * Initialize the Python execution environment
 * This should be called at application startup
 */
export async function initPythonEnvironment(): Promise<void> {
  try {
    // Ensure temp script directory exists
    await fs.mkdir(TEMP_SCRIPT_DIR, { recursive: true });
    
    // Check Python installation
    const pythonResult = await checkPythonInstallation();
    
    if (!pythonResult.installed) {
      console.error('Python is not installed or not in PATH');
      return;
    }
    
    console.log(`Python ${pythonResult.version} detected`);
    
    // Check/Install required libraries
    await checkAndInstallLibraries();
    
    console.log('Python environment initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Python environment:', error);
  }
}

/**
 * Check if Python is installed and get version
 */
async function checkPythonInstallation(): Promise<{ installed: boolean, version: string }> {
  try {
    return new Promise((resolve) => {
      const pythonProcess = spawn('python3', ['--version']);
      
      let versionOutput = '';
      pythonProcess.stdout.on('data', (data) => {
        versionOutput += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        versionOutput += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0 && versionOutput.includes('Python')) {
          const versionMatch = versionOutput.match(/Python\s+(\d+\.\d+\.\d+)/);
          const version = versionMatch ? versionMatch[1] : 'unknown';
          resolve({ installed: true, version });
        } else {
          resolve({ installed: false, version: '' });
        }
      });
    });
  } catch (error) {
    console.error('Error checking Python installation:', error);
    return { installed: false, version: '' };
  }
}

/**
 * Check and install required Python libraries if missing
 */
async function checkAndInstallLibraries(): Promise<void> {
  try {
    // Get list of installed packages
    const installedPackages = await getInstalledPackages();
    
    // Find missing libraries
    const missingLibraries = REQUIRED_LIBRARIES.filter(
      lib => !installedPackages.some(pkg => pkg.name === lib)
    );
    
    if (missingLibraries.length > 0) {
      console.log('Installing missing Python libraries:', missingLibraries.join(', '));
      await installLibraries(missingLibraries);
    } else {
      console.log('All required Python libraries are already installed');
    }
  } catch (error) {
    console.error('Error checking/installing Python libraries:', error);
  }
}

/**
 * Get list of installed Python packages
 */
async function getInstalledPackages(): Promise<Array<{ name: string, version: string }>> {
  return new Promise((resolve, reject) => {
    const pipProcess = spawn('pip3', ['list', '--format=json']);
    
    let outputData = '';
    pipProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });
    
    pipProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const packages = JSON.parse(outputData);
          resolve(packages);
        } catch (error) {
          reject(new Error(`Failed to parse pip list output: ${error.message}`));
        }
      } else {
        reject(new Error(`pip list command failed with code ${code}`));
      }
    });
    
    pipProcess.on('error', (error) => {
      reject(new Error(`Failed to execute pip: ${error.message}`));
    });
  });
}

/**
 * Install specified Python libraries
 */
async function installLibraries(libraries: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const pipProcess = spawn('pip3', ['install', ...libraries]);
    
    let outputData = '';
    pipProcess.stdout.on('data', (data) => {
      outputData += data.toString();
      console.log(`[pip] ${data.toString().trim()}`);
    });
    
    pipProcess.stderr.on('data', (data) => {
      console.error(`[pip error] ${data.toString().trim()}`);
    });
    
    pipProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pip install command failed with code ${code}`));
      }
    });
    
    pipProcess.on('error', (error) => {
      reject(new Error(`Failed to execute pip: ${error.message}`));
    });
  });
}

/**
 * Generate Python script for a screener
 */
async function generatePythonScript(screener: Screener): Promise<string> {
  // Create a unique filename for this execution
  const scriptId = uuidv4();
  const filename = path.join(TEMP_SCRIPT_DIR, `screener_${scriptId}.py`);
  
  // Import statements
  const imports = `
import pandas as pd
import numpy as np
import json
import sys
from scipy import signal
from datetime import datetime, timedelta
import matplotlib.pyplot as plt
import warnings
import yfinance as yf

# Suppress warnings
warnings.filterwarnings('ignore')

# Try to import TA-Lib, with fallback to pandas_ta
try:
    import talib as ta
except ImportError:
    print("TA-Lib not installed, using pandas_ta as fallback")
    import pandas_ta as ta

# Optional imports based on screener needs
try:
    from sklearn import preprocessing
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.svm import SVC
    from statsmodels.tsa.arima.model import ARIMA
    has_ml_libs = True
except ImportError:
    has_ml_libs = False
    print("Machine learning libraries not available")
`;

  // Helper functions
  const helperFunctions = `
def load_market_data(symbols, period='1y', interval='1d'):
    """Load market data for multiple symbols using yfinance"""
    data = {}
    if isinstance(symbols, str):
        symbols = [symbols]
    
    for symbol in symbols:
        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(period=period, interval=interval)
            if not df.empty:
                data[symbol] = df
        except Exception as e:
            print(f"Error loading data for {symbol}: {e}")
    
    return data

def calculate_technical_indicators(dataframes):
    """Calculate technical indicators for each dataframe"""
    results = {}
    
    for symbol, df in dataframes.items():
        if df.empty:
            continue
            
        # Copy dataframe to avoid SettingWithCopyWarning
        result_df = df.copy()
        
        # Basic indicators
        result_df['SMA_20'] = df['Close'].rolling(window=20).mean()
        result_df['SMA_50'] = df['Close'].rolling(window=50).mean()
        result_df['SMA_200'] = df['Close'].rolling(window=200).mean()
        
        # Volatility
        result_df['ATR'] = calculate_atr(df, 14)
        
        # Momentum
        result_df['RSI'] = calculate_rsi(df['Close'], 14)
        result_df['MACD'], result_df['MACD_Signal'], result_df['MACD_Hist'] = calculate_macd(df['Close'])
        
        # Volume
        result_df['Volume_SMA_20'] = df['Volume'].rolling(window=20).mean()
        result_df['Volume_Change'] = df['Volume'].pct_change()
        
        # Bollinger Bands
        result_df['BB_Upper'], result_df['BB_Middle'], result_df['BB_Lower'] = calculate_bollinger_bands(df['Close'])
        
        # Store results
        results[symbol] = result_df
        
    return results

def calculate_rsi(series, period=14):
    """Calculate RSI"""
    delta = series.diff()
    gain = delta.where(delta > 0, 0).rolling(window=period).mean()
    loss = -delta.where(delta < 0, 0).rolling(window=period).mean()
    
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

def calculate_macd(series, fast=12, slow=26, signal=9):
    """Calculate MACD"""
    fast_ema = series.ewm(span=fast, adjust=False).mean()
    slow_ema = series.ewm(span=slow, adjust=False).mean()
    macd = fast_ema - slow_ema
    macd_signal = macd.ewm(span=signal, adjust=False).mean()
    macd_hist = macd - macd_signal
    return macd, macd_signal, macd_hist

def calculate_bollinger_bands(series, period=20, std_dev=2):
    """Calculate Bollinger Bands"""
    middle = series.rolling(window=period).mean()
    std = series.rolling(window=period).std()
    upper = middle + (std * std_dev)
    lower = middle - (std * std_dev)
    return upper, middle, lower

def calculate_atr(df, period=14):
    """Calculate Average True Range"""
    high = df['High']
    low = df['Low']
    close = df['Close'].shift(1)
    
    tr1 = high - low
    tr2 = (high - close).abs()
    tr3 = (low - close).abs()
    
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = tr.rolling(window=period).mean()
    return atr

def detect_cup_and_handle(df, window=63):
    """Detect cup and handle pattern"""
    if len(df) < window:
        return pd.Series(False, index=df.index)
        
    # Use signal.argrelextrema to find local minima and maxima
    close = df['Close'].values
    max_idx = signal.argrelextrema(close, np.greater, order=5)[0]
    min_idx = signal.argrelextrema(close, np.less, order=5)[0]
    
    # Logic to detect cup and handle pattern
    # This is a simplified version
    cup_handle = pd.Series(False, index=df.index)
    
    return cup_handle
`;

  // Main screen execution code
  let screenCode = '';
  
  if (screener.source.type === 'code') {
    // Use the provided Python code
    screenCode = screener.source.content;
  } else {
    // If it's a natural language description, create a simple screener
    // This would be enhanced in a real implementation to use AI to generate the code
    screenCode = `
# Generated screen based on description: ${screener.description}
def screen_stocks(data_dict):
    """
    Screen stocks based on the following criteria:
    - Price above 20-day moving average
    - RSI between 30 and 70
    - Positive momentum (MACD histogram > 0)
    """
    results = {}
    matches = []
    
    for symbol, df in data_dict.items():
        if df.empty or len(df) < 50:
            continue
            
        # Get the latest data point
        latest = df.iloc[-1]
        
        # Basic screening criteria
        above_sma = latest['Close'] > latest['SMA_20']
        healthy_rsi = 30 < latest['RSI'] < 70
        positive_momentum = latest['MACD_Hist'] > 0
        
        # Combine criteria
        if above_sma and healthy_rsi and positive_momentum:
            matches.append(symbol)
            results[symbol] = {
                'close': latest['Close'],
                'sma_20': latest['SMA_20'],
                'rsi': latest['RSI'],
                'macd_hist': latest['MACD_Hist'],
            }
    
    return {
        'matches': matches,
        'details': results
    }
`;
  }

  // Main execution block
  const mainExecution = `
# Main execution
if __name__ == "__main__":
    try:
        # Load configuration
        config = ${JSON.stringify(screener.configuration)}
        
        # Load ticker data
        symbols = config.get('assets', [])
        if not symbols:
            print(json.dumps({
                'success': False,
                'error': 'No symbols specified',
                'matches': []
            }))
            sys.exit(1)
        
        # Load market data
        data_dict = load_market_data(symbols)
        
        # Calculate technical indicators
        data_with_indicators = calculate_technical_indicators(data_dict)
        
        # Run the screen
        start_time = datetime.now()
        screen_results = screen_stocks(data_with_indicators)
        end_time = datetime.now()
        execution_time = (end_time - start_time).total_seconds()
        
        # Return results
        result = {
            'success': True,
            'screener_id': ${screener.id},
            'matches': screen_results['matches'],
            'details': screen_results.get('details', {}),
            'execution_time': execution_time,
            'timestamp': datetime.now().isoformat()
        }
        print(json.dumps(result))
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(json.dumps({
            'success': False,
            'error': str(e),
            'details': error_details,
            'matches': []
        }))
        sys.exit(1)
`;

  // Combine all parts
  const fullScript = imports + helperFunctions + screenCode + mainExecution;
  
  // Write the script to a file
  await fs.writeFile(filename, fullScript);
  
  return filename;
}

/**
 * Execute a Python screener
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
 * Run a Python script and return the results
 */
async function runPythonScript(scriptPath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', [scriptPath]);
    
    let outputData = '';
    let errorData = '';
    
    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
      console.error(`[Python Error] ${data.toString().trim()}`);
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          // The script should output JSON
          const result = JSON.parse(outputData);
          resolve(result);
        } catch (error) {
          console.error('Failed to parse Python script output as JSON:', outputData);
          reject(new Error('Invalid output from Python script'));
        }
      } else {
        reject(new Error(`Python script exited with code ${code}: ${errorData}`));
      }
    });
    
    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to execute Python script: ${error.message}`));
    });
  });
}