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
// Note: Removed TA-Lib due to installation complexities, using pandas_ta instead
const REQUIRED_LIBRARIES = [
  'pandas',
  'numpy',
  'scipy',
  'matplotlib',
  'pandas_ta', // Extended TA functionality integrated with pandas
  'scikit-learn', // For ML-based screening
  'statsmodels', // For statistical analysis
  'yfinance', // For easy data access
  'mplfinance', // For financial chart visualization
  'plotly', // For interactive charts
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
import pandas_ta as ta  # Use pandas_ta as ta for easier replacement

# Suppress warnings
warnings.filterwarnings('ignore')

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
    """Calculate technical indicators for each dataframe using pandas_ta"""
    results = {}
    
    for symbol, df in dataframes.items():
        if df.empty:
            continue
            
        # Copy dataframe to avoid SettingWithCopyWarning
        result_df = df.copy()
        
        # Basic indicators using pandas_ta
        # Moving Averages
        result_df['SMA_20'] = ta.sma(df['Close'], length=20)
        result_df['SMA_50'] = ta.sma(df['Close'], length=50)
        result_df['SMA_200'] = ta.sma(df['Close'], length=200)
        result_df['EMA_20'] = ta.ema(df['Close'], length=20)
        
        # Volatility indicators
        atr = ta.atr(df['High'], df['Low'], df['Close'], length=14)
        result_df['ATR'] = atr
        # Calculate NATR manually since pandas_ta doesn't have a direct equivalent
        result_df['NATR'] = 100 * atr / df['Close']
        
        # Bollinger Bands
        bbands = ta.bbands(df['Close'], length=20, std=2)
        result_df['BB_Upper'] = bbands['BBU_20_2.0']
        result_df['BB_Middle'] = bbands['BBM_20_2.0']
        result_df['BB_Lower'] = bbands['BBL_20_2.0']
        
        # Momentum indicators
        result_df['RSI'] = ta.rsi(df['Close'], length=14)
        macd = ta.macd(df['Close'], fast=12, slow=26, signal=9)
        result_df['MACD'] = macd['MACD_12_26_9']
        result_df['MACD_Signal'] = macd['MACDs_12_26_9']
        result_df['MACD_Hist'] = macd['MACDh_12_26_9']
        
        # Stochastic
        stoch = ta.stoch(df['High'], df['Low'], df['Close'], k=14, d=3, smooth_k=3)
        result_df['SlowK'] = stoch['STOCHk_14_3_3']
        result_df['SlowD'] = stoch['STOCHd_14_3_3']
        
        # ADX and Directional Movement
        adx = ta.adx(df['High'], df['Low'], df['Close'], length=14)
        result_df['ADX'] = adx['ADX_14']
        result_df['PLUS_DI'] = adx['DMP_14']
        result_df['MINUS_DI'] = adx['DMN_14']
        
        # Volume indicators
        result_df['OBV'] = ta.obv(df['Close'], df['Volume'])
        result_df['Volume_SMA_20'] = ta.sma(df['Volume'], length=20)
        result_df['Volume_Change'] = df['Volume'].pct_change()
        
        # Calculate a weekly resampled dataframe for weekly patterns
        try:
            # Weekly MACD for longer-term trend analysis
            df_weekly = df.resample('W-FRI').last()
            if len(df_weekly) > 30:  # Ensure enough data points
                weekly_macd = ta.macd(df_weekly['Close'])
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
        
        # Cup and Handle pattern (custom implementation)
        result_df['CUP_HANDLE'] = detect_cup_and_handle(df)
        
        # Add Ichimoku Cloud
        try:
            ichimoku = ta.ichimoku(df['High'], df['Low'], df['Close'])
            result_df = pd.concat([result_df, ichimoku], axis=1)
        except Exception as e:
            print(f"Error calculating Ichimoku Cloud: {e}")
            
        # Add more advanced pandas_ta indicators
        try:
            # Elder Ray Bull Power and Bear Power
            elder = ta.elder(df['High'], df['Low'], df['Close'])
            result_df = pd.concat([result_df, elder], axis=1)
            
            # Volume Weighted Average Price (VWAP)
            vwap = ta.vwap(df['High'], df['Low'], df['Close'], df['Volume'])
            result_df['VWAP'] = vwap
            
            # Squeeze Momentum Indicator
            squeeze = ta.squeeze(df['High'], df['Low'], df['Close'])
            result_df = pd.concat([result_df, squeeze], axis=1)
            
            # Detect classic technical patterns
            result_df['DOJI'] = ta.cdl_doji(df['Open'], df['High'], df['Low'], df['Close'])
            result_df['HAMMER'] = ta.cdl_hammer(df['Open'], df['High'], df['Low'], df['Close'])
            result_df['SHOOTING_STAR'] = ta.cdl_shootingstar(df['Open'], df['High'], df['Low'], df['Close'])
            result_df['ENGULFING'] = ta.cdl_engulfing(df['Open'], df['High'], df['Low'], df['Close'])
            
        except Exception as e:
            print(f"Error calculating advanced indicators: {e}")
        
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
# Fix for pandas_ta import issue with numpy NaN
import numpy as np
np.NaN = np.nan

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
        
        # First check if there's a custom universe defined in the user code or source
        # This allows advanced users to define their own symbols directly
        custom_universe_defined = False
        
        # Look for custom universe definition in the source code
        if 'def get_stock_universe(' in '${screener.source.content}':
            print("Found custom universe function in the code")
            custom_universe_defined = True
            try:
                # Execute the function if it exists
                symbols = get_stock_universe()
                print(f"Using {len(symbols)} symbols from custom universe function")
            except Exception as e:
                print(f"Error executing custom universe function: {e}")
                custom_universe_defined = False
                
        # If no custom universe or it failed, check the config
        if not custom_universe_defined:
            # Get the symbols from the config if provided
            symbols = config.get('assets', [])
            
            # Check if user specified a specific universe
            stock_universe = config.get('stock_universe', '')
            
            # If specific universe requested, override
            if stock_universe and isinstance(stock_universe, str):
                print(f"Using predefined universe: {stock_universe}")
                
                if stock_universe.lower() == 'sp500':
                    # S&P 500 stocks
                    from urllib.request import urlopen
                    import json
                    
                    try:
                        # Get S&P 500 components from Wikipedia
                        url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
                        import pandas as pd
                        tables = pd.read_html(url)
                        sp500_table = tables[0]
                        symbols = sp500_table['Symbol'].tolist()
                        print(f"Retrieved {len(symbols)} S&P 500 symbols from Wikipedia")
                    except Exception as e:
                        print(f"Error fetching S&P 500 list: {e}")
                        symbols = []
                
                elif stock_universe.lower() == 'nasdaq100':
                    # NASDAQ 100 stocks
                    try:
                        url = "https://en.wikipedia.org/wiki/Nasdaq-100"
                        import pandas as pd
                        tables = pd.read_html(url)
                        nasdaq100_table = tables[4]  # Table index may change if Wikipedia layout changes
                        symbols = nasdaq100_table['Ticker'].tolist()
                        print(f"Retrieved {len(symbols)} NASDAQ 100 symbols from Wikipedia")
                    except Exception as e:
                        print(f"Error fetching NASDAQ 100 list: {e}")
                        symbols = []
                
                elif stock_universe.lower() == 'dow30':
                    # Dow Jones 30 stocks
                    try:
                        url = "https://en.wikipedia.org/wiki/Dow_Jones_Industrial_Average"
                        import pandas as pd
                        tables = pd.read_html(url)
                        dow30_table = tables[1]  # Table index may change if Wikipedia layout changes
                        symbols = dow30_table['Symbol'].tolist()
                        print(f"Retrieved {len(symbols)} Dow 30 symbols from Wikipedia")
                    except Exception as e:
                        print(f"Error fetching Dow 30 list: {e}")
                        symbols = []
            
            # If still no symbols, fetch comprehensive stock list
            if not symbols:
                print("No specific assets provided, fetching comprehensive stock list...")
                
                try:
                    # Based on data provider, fetch a comprehensive list of tradable symbols
                    
                    # Yahoo Finance approach - get major indices plus sectoral ETFs for full market coverage
                    if data_provider.lower() == 'yahoo':
                        try:
                            # Import necessary libraries
                            import yfinance as yf
                            from concurrent.futures import ThreadPoolExecutor, as_completed
                            import random
                            
                            # First, try to get S&P 500 components from Wikipedia since yfinance may not return holdings
                            try:
                                url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
                                tables = pd.read_html(url)
                                sp500_table = tables[0]
                                all_symbols = set(sp500_table['Symbol'].tolist())
                                print(f"Retrieved {len(all_symbols)} S&P 500 symbols from Wikipedia")
                            except Exception as e:
                                print(f"Error fetching S&P 500 list from Wikipedia: {e}")
                                all_symbols = set()
                            
                            # If we couldn't get S&P 500 from Wikipedia, try sector ETFs
                            if not all_symbols:
                                print("Using sector ETFs to get component stocks...")
                                
                                # Major sector ETFs that contain most tradable stocks
                                sector_etfs = [
                                    'XLK',  # Technology
                                    'XLF',  # Financials
                                    'XLV',  # Healthcare
                                    'XLE',  # Energy
                                    'XLY',  # Consumer Discretionary
                                    'XLP',  # Consumer Staples
                                    'XLI',  # Industrials
                                    'XLB',  # Materials
                                    'XLU',  # Utilities
                                    'XLRE', # Real Estate
                                    'XLC',  # Communication Services
                                ]
                                
                                for etf in sector_etfs:
                                    try:
                                        # Get ETF holdings
                                        etf_ticker = yf.Ticker(etf)
                                        holdings = etf_ticker.get_holdings()
                                        if isinstance(holdings, pd.DataFrame) and not holdings.empty:
                                            etf_symbols = holdings.index.tolist()
                                            print(f"Found {len(etf_symbols)} stocks in {etf}")
                                            all_symbols.update(etf_symbols)
                                    except Exception as e:
                                        print(f"Error getting holdings for {etf}: {e}")
                            
                            # If still not enough symbols, add a large list of popular stocks
                            if len(all_symbols) < 100:
                                print("Adding predefined major US stocks list...")
                                
                                # Extensive list of common stocks across sectors
                                major_stocks = [
                                    # Technology
                                    "AAPL", "MSFT", "GOOGL", "GOOG", "META", "NVDA", "AVGO", "CSCO", "ORCL", "IBM", "ADBE",
                                    "AMD", "INTC", "TSM", "MU", "QCOM", "TXN", "AMAT", "CRM", "NOW", "INTU", "ACN", "PYPL",
                                    "SNOW", "NET", "CRWD", "ZS", "PANW", "FTNT", "DDOG", "PLTR", "U", "TEAM", "ADSK", "WDAY",
                                    
                                    # Healthcare
                                    "JNJ", "PFE", "ABBV", "MRK", "AMGN", "LLY", "BMY", "TMO", "DHR", "UNH", "CVS", "GILD", 
                                    "ISRG", "VRTX", "ZTS", "REGN", "BIIB", "MRNA", "ILMN", "MDT", "BSX", "EW", "HUM", "CNC",
                                    "ALGN", "VEEV", "IQV", "BDX", "ZBH", "TMUS", "BAX", "CI", "IDXX", "MTD", "A", "WAT",
                                    
                                    # Finance
                                    "JPM", "BAC", "WFC", "C", "GS", "MS", "AXP", "V", "MA", "BLK", "SCHW", "BRK-B", "CB", 
                                    "AIG", "PNC", "USB", "TFC", "COF", "ALL", "PGR", "MMC", "AON", "MET", "PRU", "TRV",
                                    "SPGI", "ICE", "CME", "MCO", "MSCI", "FIS", "FISV", "DFS", "SYF", "STT", "BK", "NTRS",
                                    
                                    # Consumer
                                    "AMZN", "TSLA", "WMT", "HD", "MCD", "NKE", "SBUX", "TGT", "COST", "LOW", "PG", "KO", 
                                    "PEP", "PM", "MO", "EL", "CL", "KMB", "GIS", "K", "MDLZ", "HSY", "CPB", "CAG", "SJM",
                                    "STZ", "TAP", "BF-B", "KHC", "KR", "DG", "DLTR", "ORLY", "AZO", "ULTA", "ROST", "TJX", 
                                    "BBY", "EBAY", "ETSY", "W", "BKNG", "EXPE", "MAR", "HLT", "RCL", "CCL", "YUM", "DPZ",
                                ]
                                
                                all_symbols.update(major_stocks)
                                print(f"Added {len(major_stocks)} major stocks to universe")
                                
                            # Final list of symbols
                            symbols = list(all_symbols)
                            print(f"Using {len(symbols)} symbols from Yahoo Finance sources")
                            
                            # If user requested a specific max count, limit the symbols
                            max_stocks = config.get('max_stocks', 0)
                            if max_stocks > 0 and max_stocks < len(symbols):
                                # Randomly sample to the requested size
                                symbols = random.sample(symbols, max_stocks)
                                print(f"Limited to {len(symbols)} random symbols as requested")
                        
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