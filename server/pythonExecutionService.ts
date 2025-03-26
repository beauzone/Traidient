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
    
    try {
      // Check/Install required libraries
      await checkAndInstallLibraries();
    } catch (error) {
      console.error('Error checking/installing Python libraries:', error);
      // Continue execution even if libraries can't be installed
      // The application will attempt to use what's available
    }
    
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
import os
from datetime import datetime, timedelta
import warnings
import yfinance as yf
import talib as ta
import pandas_ta as pta

# Suppress warnings
warnings.filterwarnings('ignore')

# Use both talib and pandas_ta for comprehensive technical indicator support
# Check if environmental variables for API providers are available
ALPACA_API_KEY = os.environ.get('ALPACA_API_KEY', '')
ALPACA_API_SECRET = os.environ.get('ALPACA_API_SECRET', '')
POLYGON_API_KEY = os.environ.get('POLYGON_API_KEY', '')
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
    """Calculate technical indicators for each dataframe using TA-Lib and pandas_ta"""
    results = {}
    
    for symbol, df in dataframes.items():
        if df.empty:
            continue
            
        # Copy dataframe to avoid SettingWithCopyWarning
        result_df = df.copy()
        
        # Basic indicators using TA-Lib
        # Moving Averages
        result_df['SMA_20'] = ta.SMA(df['Close'], timeperiod=20)
        result_df['SMA_50'] = ta.SMA(df['Close'], timeperiod=50)
        result_df['SMA_200'] = ta.SMA(df['Close'], timeperiod=200)
        result_df['EMA_20'] = ta.EMA(df['Close'], timeperiod=20)
        
        # Volatility indicators
        result_df['ATR'] = ta.ATR(df['High'], df['Low'], df['Close'], timeperiod=14)
        result_df['NATR'] = ta.NATR(df['High'], df['Low'], df['Close'], timeperiod=14)
        
        # Bollinger Bands
        result_df['BB_Upper'], result_df['BB_Middle'], result_df['BB_Lower'] = ta.BBANDS(
            df['Close'], 
            timeperiod=20,
            nbdevup=2,
            nbdevdn=2,
            matype=0
        )
        
        # Momentum indicators
        result_df['RSI'] = ta.RSI(df['Close'], timeperiod=14)
        macd, macdsignal, macdhist = ta.MACD(
            df['Close'], 
            fastperiod=12, 
            slowperiod=26, 
            signalperiod=9
        )
        result_df['MACD'] = macd
        result_df['MACD_Signal'] = macdsignal
        result_df['MACD_Hist'] = macdhist
        
        # Stochastic
        result_df['SlowK'], result_df['SlowD'] = ta.STOCH(
            df['High'], 
            df['Low'], 
            df['Close'],
            fastk_period=14,
            slowk_period=3,
            slowk_matype=0,
            slowd_period=3,
            slowd_matype=0
        )
        
        # ADX and Directional Movement
        result_df['ADX'] = ta.ADX(df['High'], df['Low'], df['Close'], timeperiod=14)
        result_df['PLUS_DI'] = ta.PLUS_DI(df['High'], df['Low'], df['Close'], timeperiod=14)
        result_df['MINUS_DI'] = ta.MINUS_DI(df['High'], df['Low'], df['Close'], timeperiod=14)
        
        # Volume indicators
        result_df['OBV'] = ta.OBV(df['Close'], df['Volume'])
        result_df['Volume_SMA_20'] = ta.SMA(df['Volume'], timeperiod=20)
        result_df['Volume_Change'] = df['Volume'].pct_change()
        
        # Add some pandas_ta indicators for additional functionality
        # Calculate a weekly resampled dataframe for weekly patterns
        try:
            # Weekly MACD for longer-term trend analysis
            df_weekly = df.resample('W-FRI').last()
            if len(df_weekly) > 30:  # Ensure enough data points
                weekly_macd = pta.macd(df_weekly['Close'])
                # Map the weekly values back to the daily dataframe
                # This creates a step function where weekly values are repeated daily
                weekly_dates = weekly_macd.index
                weekly_values = weekly_macd['MACDh_12_26_9'].values
                
                # Create a Series with the weekly values
                weekly_series = pd.Series(index=weekly_dates, data=weekly_values)
                # Reindex to daily values (forward fill)
                daily_macd = weekly_series.reindex(df.index, method='ffill')
                result_df['WEEKLY_MACD_HIST'] = daily_macd
        except Exception as e:
            print(f"Error calculating weekly indicators: {e}")
            result_df['WEEKLY_MACD_HIST'] = float('nan')
        
        # 12-month high/low
        result_df['MAX_12MO'] = df['Close'].rolling(253).max()
        result_df['MIN_12MO'] = df['Close'].rolling(253).min()
        
        # Detect patterns using both TA-Lib and pandas_ta
        try:
            # Cup and Handle pattern (custom implementation)
            result_df['CUP_HANDLE'] = detect_cup_and_handle(df)
            
            # TA-Lib pattern recognition (returns integer values where 100 = pattern found)
            result_df['ENGULFING'] = ta.CDLENGULFING(df['Open'], df['High'], df['Low'], df['Close'])
            result_df['HAMMER'] = ta.CDLHAMMER(df['Open'], df['High'], df['Low'], df['Close'])
            result_df['DOJI'] = ta.CDLDOJI(df['Open'], df['High'], df['Low'], df['Close'])
            result_df['EVENING_STAR'] = ta.CDLEVENINGSTAR(df['Open'], df['High'], df['Low'], df['Close'])
            result_df['MORNING_STAR'] = ta.CDLMORNINGSTAR(df['Open'], df['High'], df['Low'], df['Close'])
        except Exception as e:
            print(f"Error calculating pattern recognition: {e}")
        
        # Store results
        results[symbol] = result_df
        
    return results

def detect_cup_and_handle(df, window=63):
    """Detect cup and handle pattern using a simpler approach without scipy.signal"""
    if len(df) < window:
        return pd.Series(False, index=df.index)
        
    # A simple implementation without scipy.signal dependency
    # Basic pattern detection - not as accurate but works without dependencies
    cup_handle = pd.Series(False, index=df.index)
    
    # Simplified implementation that checks for:
    # 1. Initial high
    # 2. Drop (cup)
    # 3. Rise back to near initial high
    # 4. Small drop and rise again (handle)
    for i in range(40, len(df) - 20):
        if i < 50:
            continue
            
        # Get price segments
        pre_cup = df['Close'].iloc[i-40:i-20]
        cup_bottom = df['Close'].iloc[i-20:i]
        post_cup = df['Close'].iloc[i:i+20]
        
        pre_cup_high = pre_cup.max()
        cup_low = cup_bottom.min()
        post_cup_high = post_cup.max()
        
        cup_depth = (pre_cup_high - cup_low) / pre_cup_high
        recovery = (post_cup_high - cup_low) / (pre_cup_high - cup_low)
        
        # Check for cup shape: significant drop and recovery
        if 0.1 < cup_depth < 0.5 and recovery > 0.7:
            cup_handle.iloc[i] = True
    
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
        
        # Use comprehensive stock universes for screening
        # Import necessary packages for data providers
        import os
        
        # Data provider selection - supports multiple sources
        # Default to 'yahoo' if not specified, but also support 'alpaca' and 'polygon'
        data_provider = config.get('data_provider', 'yahoo')
        print(f"Using data provider: {data_provider}")
        
        # Get the symbols from the config if provided
        symbols = config.get('assets', [])
        
        if not symbols:
            print("No specific assets provided, fetching complete stock universe...")
            
            try:
                # Based on data provider, fetch a comprehensive list of tradable symbols
                
                # Yahoo Finance approach - get S&P 500 components plus other major indices
                if data_provider.lower() == 'yahoo':
                    try:
                        # Get S&P 500 components first
                        import yfinance as yf
                        from concurrent.futures import ThreadPoolExecutor, as_completed
                        
                        # Start with major indices components
                        indices = {
                            '^GSPC': 'S&P 500',
                            '^DJI': 'Dow Jones',
                            '^IXIC': 'NASDAQ',
                            '^RUT': 'Russell 2000'
                        }
                        
                        all_symbols = set()
                        
                        # Try to download constituents from S&P 500 index
                        print("Fetching index constituents...")
                        try:
                            sp500 = yf.Ticker('^GSPC')
                            # This isn't always available, but worth trying
                            sp500_constituents = sp500.get_holdings()
                            if isinstance(sp500_constituents, pd.DataFrame) and not sp500_constituents.empty:
                                print(f"Found {len(sp500_constituents)} S&P 500 constituents")
                                all_symbols.update(sp500_constituents.index.tolist())
                        except Exception as e:
                            print(f"Failed to get S&P 500 constituents: {e}")
                        
                        # If still empty, use the top stocks from each sector
                        if not all_symbols:
                            print("Using predefined major US stocks list...")
                            
                            # Fall back to a larger predefined list of common stocks
                            # Include top stocks from major sectors
                            major_stocks = [
                                # Technology
                                "AAPL", "MSFT", "GOOGL", "META", "NVDA", "AVGO", "CSCO", "ORCL", "IBM", "ADBE",
                                "AMD", "INTC", "TSM", "MU", "QCOM", "TXN", "AMAT", "CRM", "NOW", "INTU",
                                
                                # Healthcare
                                "JNJ", "PFE", "ABBV", "MRK", "AMGN", "LLY", "BMY", "TMO", "DHR", "UNH",
                                "CVS", "GILD", "ISRG", "VRTX", "ZTS", "REGN", "BIIB", "MRNA", "ILMN", "MDT",
                                
                                # Finance
                                "JPM", "BAC", "WFC", "C", "GS", "MS", "AXP", "V", "MA", "BLK",
                                "SCHW", "BRK.B", "CB", "AIG", "PNC", "USB", "TFC", "COF", "ALL", "PGR",
                                
                                # Consumer
                                "AMZN", "TSLA", "WMT", "HD", "MCD", "NKE", "SBUX", "TGT", "COST", "LOW",
                                "PG", "KO", "PEP", "PM", "MO", "EL", "CL", "KMB", "GIS", "K",
                                
                                # Energy & Materials
                                "XOM", "CVX", "COP", "BP", "TOT", "SLB", "EOG", "PSX", "VLO", "KMI",
                                "LIN", "DD", "DOW", "FCX", "APD", "ECL", "NEM", "SHW", "NUE", "VMC",
                                
                                # Telecom & Media
                                "VZ", "T", "TMUS", "CMCSA", "NFLX", "DIS", "CHTR", "DISH", "LYV", "PARA",
                                
                                # Industrials & Transportation
                                "GE", "HON", "MMM", "CAT", "DE", "UPS", "FDX", "LMT", "GD", "RTX",
                                "BA", "UNP", "CSX", "NSC", "DAL", "UAL", "AAL", "LUV", "JBLU", "ALK"
                            ]
                            
                            all_symbols.update(major_stocks)
                            print(f"Added {len(major_stocks)} major stocks to universe")
                            
                        symbols = list(all_symbols)
                        print(f"Using {len(symbols)} symbols from Yahoo Finance")
                    
                    except Exception as e:
                        print(f"Error fetching Yahoo Finance stock universe: {e}")
                        # Fall back to a basic set of symbols
                        symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"]
                        print(f"Falling back to basic {len(symbols)} symbols")
                
                # Alpaca approach - use their API to get all tradable stocks
                elif data_provider.lower() == 'alpaca':
                    try:
                        # Use Alpaca API to get tradable assets
                        import alpaca_trade_api as tradeapi
                        
                        # Get keys from environment
                        api_key = os.environ.get('ALPACA_API_KEY', '')
                        api_secret = os.environ.get('ALPACA_API_SECRET', '')
                        
                        if api_key and api_secret:
                            try:
                                # Initialize Alpaca API
                                api = tradeapi.REST(api_key, api_secret, base_url='https://paper-api.alpaca.markets')
                                
                                # Get all active US equities
                                assets = api.list_assets(status='active', asset_class='us_equity')
                                
                                # Extract symbols
                                symbols = [asset.symbol for asset in assets]
                                print(f"Using {len(symbols)} symbols from Alpaca")
                            except Exception as e:
                                print(f"Error connecting to Alpaca API: {e}")
                                # Fall back to Yahoo approach
                                print("Falling back to basic symbols")
                                symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"]
                        else:
                            print("Alpaca API credentials not found, falling back to basic symbols")
                            symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"]
                    
                    except Exception as e:
                        print(f"Error setting up Alpaca: {e}")
                        symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"]
                
                # Polygon approach - use their API to get all tradable stocks
                elif data_provider.lower() == 'polygon':
                    try:
                        from polygon import RESTClient
                        
                        # Get API key from environment
                        api_key = os.environ.get('POLYGON_API_KEY', '')
                        
                        if api_key:
                            try:
                                # Initialize Polygon client
                                client = RESTClient(api_key)
                                
                                # Get all US equities (common stocks)
                                print("Fetching stock tickers from Polygon...")
                                tickers = client.list_tickers(market="stocks", type="cs", active=True, limit=1000)
                                
                                # Extract symbols
                                symbols = [ticker.ticker for ticker in tickers]
                                print(f"Using {len(symbols)} symbols from Polygon")
                            except Exception as e:
                                print(f"Error connecting to Polygon API: {e}")
                                # Fall back to basic symbols
                                symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"]
                        else:
                            print("Polygon API key not found, falling back to basic symbols")
                            symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"]
                    
                    except Exception as e:
                        print(f"Error setting up Polygon: {e}")
                        symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"]
                
                else:
                    print(f"Unknown data provider: {data_provider}, using basic symbols")
                    symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"]
            
            except Exception as e:
                print(f"Error fetching stock universe: {e}")
                # Absolute fallback - basic symbols
                symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"]
            
            if not symbols:
                print("Failed to get any symbols, using basic list")
                symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"]
                
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