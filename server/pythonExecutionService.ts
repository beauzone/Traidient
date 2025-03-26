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
def load_market_data(symbols, period='3mo', interval='1d'):
    """Load market data for multiple symbols using yfinance"""
    print(f"Loading data for {len(symbols)} symbols with period {period}, interval {interval}...")
    
    data = {}
    if isinstance(symbols, str):
        symbols = [symbols]
    
    for symbol in symbols:
        try:
            ticker = yf.Ticker(symbol)
            history = ticker.history(period=period, interval=interval)
            if not history.empty:
                data[symbol] = history
                print(f"Loaded data for {symbol}: {len(history)} bars")
            else:
                print(f"No data available for {symbol}")
        except Exception as e:
            print(f"Error loading data for {symbol}: {str(e)}")
    
    print(f"Successfully loaded data for {len(data)} symbols")
    return data

def calculate_technical_indicators(dataframes):
    """Calculate technical indicators using numpy and pandas"""
    results = {}
    
    for symbol, df in dataframes.items():
        if df.empty:
            continue
            
        # Copy dataframe to avoid SettingWithCopyWarning
        result_df = df.copy()
        
        # Moving Averages
        result_df['SMA_20'] = df['Close'].rolling(window=20).mean()
        result_df['SMA_50'] = df['Close'].rolling(window=50).mean()
        result_df['SMA_200'] = df['Close'].rolling(window=200).mean()
        
        # Calculate EMA manually
        result_df['EMA_20'] = df['Close'].ewm(span=20, adjust=False).mean()
        
        # Volatility indicators - ATR calculation
        high_low = df['High'] - df['Low']
        high_close = abs(df['High'] - df['Close'].shift())
        low_close = abs(df['Low'] - df['Close'].shift())
        ranges = pd.concat([high_low, high_close, low_close], axis=1)
        true_range = ranges.max(axis=1)
        result_df['ATR'] = true_range.rolling(14).mean()
        result_df['NATR'] = result_df['ATR'] / df['Close'] * 100
        
        # Bollinger Bands
        result_df['BB_Middle'] = result_df['SMA_20']
        result_df['BB_StdDev'] = df['Close'].rolling(window=20).std()
        result_df['BB_Upper'] = result_df['BB_Middle'] + 2 * result_df['BB_StdDev']
        result_df['BB_Lower'] = result_df['BB_Middle'] - 2 * result_df['BB_StdDev']
        
        # RSI Calculation
        delta = df['Close'].diff()
        gain = delta.where(delta > 0, 0)
        loss = -delta.where(delta < 0, 0)
        avg_gain = gain.rolling(window=14).mean()
        avg_loss = loss.rolling(window=14).mean()
        
        # Handle division by zero
        avg_loss = avg_loss.replace(0, 0.00001)
        rs = avg_gain / avg_loss
        result_df['RSI'] = 100 - (100 / (1 + rs))
        
        # MACD Calculation
        ema_12 = df['Close'].ewm(span=12, adjust=False).mean()
        ema_26 = df['Close'].ewm(span=26, adjust=False).mean()
        result_df['MACD'] = ema_12 - ema_26
        result_df['MACD_Signal'] = result_df['MACD'].ewm(span=9, adjust=False).mean()
        result_df['MACD_Hist'] = result_df['MACD'] - result_df['MACD_Signal']
        
        # Volume indicators
        # On-Balance Volume (OBV)
        obv = [0]
        for i in range(1, len(df)):
            if df['Close'].iloc[i] > df['Close'].iloc[i-1]:
                obv.append(obv[-1] + df['Volume'].iloc[i])
            elif df['Close'].iloc[i] < df['Close'].iloc[i-1]:
                obv.append(obv[-1] - df['Volume'].iloc[i])
            else:
                obv.append(obv[-1])
        result_df['OBV'] = obv
        result_df['Volume_SMA_20'] = df['Volume'].rolling(window=20).mean()
        result_df['Volume_Change'] = df['Volume'].pct_change()
        
        # ADX and Directional Indicators
        try:
            # Calculate True Range first
            high_low = df['High'] - df['Low']
            high_prev_close = abs(df['High'] - df['Close'].shift(1))
            low_prev_close = abs(df['Low'] - df['Close'].shift(1))
            tr = pd.concat([high_low, high_prev_close, low_prev_close], axis=1).max(axis=1)
            
            # Calculate +DM and -DM
            pos_dm = df['High'].diff()
            neg_dm = df['Low'].diff().multiply(-1)
            pos_dm = pos_dm.where((pos_dm > neg_dm) & (pos_dm > 0), 0)
            neg_dm = neg_dm.where((neg_dm > pos_dm) & (neg_dm > 0), 0)
            
            # Smoothed TR, +DM, and -DM using Wilder's smoothing
            period = 14
            tr_smoothed = tr.copy()
            pos_dm_smoothed = pos_dm.copy()
            neg_dm_smoothed = neg_dm.copy()
            
            for i in range(1, len(df)):
                tr_smoothed.iloc[i] = tr_smoothed.iloc[i-1] - (tr_smoothed.iloc[i-1] / period) + tr.iloc[i]
                pos_dm_smoothed.iloc[i] = pos_dm_smoothed.iloc[i-1] - (pos_dm_smoothed.iloc[i-1] / period) + pos_dm.iloc[i]
                neg_dm_smoothed.iloc[i] = neg_dm_smoothed.iloc[i-1] - (neg_dm_smoothed.iloc[i-1] / period) + neg_dm.iloc[i]
            
            # Calculate +DI and -DI
            pos_di = 100 * pos_dm_smoothed / tr_smoothed
            neg_di = 100 * neg_dm_smoothed / tr_smoothed
            
            # Calculate DX
            dx = 100 * abs(pos_di - neg_di) / (pos_di + neg_di)
            
            # Calculate ADX with smoothing
            adx = pd.Series(index=df.index, data=np.nan)
            adx.iloc[period*2-1] = dx.iloc[period:period*2].mean()  # First ADX value
            
            for i in range(period*2, len(df)):
                adx.iloc[i] = (adx.iloc[i-1] * (period-1) + dx.iloc[i]) / period
            
            # Store ADX and DI indicators
            result_df['PLUS_DI'] = pos_di
            result_df['MINUS_DI'] = neg_di
            result_df['ADX'] = adx
        except Exception as e:
            print(f"Error calculating ADX indicators: {e}")
            result_df['PLUS_DI'] = float('nan')
            result_df['MINUS_DI'] = float('nan')
            result_df['ADX'] = float('nan')
        
        # Weekly MACD for longer-term trend analysis
        try:
            df_weekly = df.resample('W-FRI').last()
            if len(df_weekly) > 30:  # Ensure enough data points
                ema_12_weekly = df_weekly['Close'].ewm(span=12, adjust=False).mean()
                ema_26_weekly = df_weekly['Close'].ewm(span=26, adjust=False).mean()
                macd_weekly = ema_12_weekly - ema_26_weekly
                macd_signal_weekly = macd_weekly.ewm(span=9, adjust=False).mean()
                macd_hist_weekly = macd_weekly - macd_signal_weekly
                
                # Map the weekly values back to the daily dataframe
                # This creates a step function where weekly values are repeated daily
                weekly_dates = macd_hist_weekly.index
                weekly_values = macd_hist_weekly.values
                
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
def screen_stocks(data_dict, screen_type='momentum'):
    """
    Screen stocks based on selected strategy type
    Available strategies: 'momentum', 'technical', 'trend_following', 'williams'
    
    Default strategy includes:
    - Price above 20-day moving average
    - RSI between 30 and 70 (not overbought or oversold)
    - Positive momentum (MACD histogram > 0)
    - Volume above 20-day average
    """
    matches = []
    details = {}
    
    print(f"Running {screen_type} screen on {len(data_dict)} stocks")
    
    # Default screen type if not specified
    if not screen_type:
        screen_type = 'momentum'
    
    # Momentum Strategy Screen (default)
    if screen_type == 'momentum':
        for symbol, df in data_dict.items():
            if df.empty or len(df) < 50:
                continue
                
            try:
                # Get most recent data point
                latest = df.iloc[-1]
                
                # Screen criteria
                price_above_sma20 = latest['Close'] > latest['SMA_20']
                healthy_rsi = 30 < latest['RSI'] < 70
                positive_macd = latest['MACD_Hist'] > 0
                volume_above_avg = latest['Volume'] > latest['Volume_SMA_20']
                
                # All criteria must be met
                if price_above_sma20 and healthy_rsi and positive_macd and volume_above_avg:
                    matches.append(symbol)
                    details[symbol] = {
                        'close': round(latest['Close'], 2),
                        'sma_20': round(latest['SMA_20'], 2),
                        'rsi': round(latest['RSI'], 2),
                        'macd_hist': round(latest['MACD_Hist'], 4),
                        'volume_ratio': round(latest['Volume'] / latest['Volume_SMA_20'], 2)
                    }
            except Exception as e:
                print(f"Error screening {symbol} with momentum strategy: {str(e)}")
    
    # Trend Following Strategy using ADX and Directional Indicators
    elif screen_type == 'trend_following':
        for symbol, df in data_dict.items():
            if df.empty or len(df) < 50:
                continue
                
            try:
                # Get most recent data point
                latest = df.iloc[-1]
                
                # Screen criteria
                strong_trend = latest['ADX'] > 25  # ADX > 25 indicates a strong trend
                uptrend = latest['PLUS_DI'] > latest['MINUS_DI']  # +DI > -DI indicates uptrend
                price_above_sma50 = latest['Close'] > latest['SMA_50']  # Price above longer-term MA
                
                # Weekly trend confirmation if available
                weekly_uptrend = True
                if 'WEEKLY_MACD_HIST' in latest and not pd.isna(latest['WEEKLY_MACD_HIST']):
                    weekly_uptrend = latest['WEEKLY_MACD_HIST'] > 0
                
                # All criteria must be met
                if strong_trend and uptrend and price_above_sma50 and weekly_uptrend:
                    matches.append(symbol)
                    details[symbol] = {
                        'close': round(latest['Close'], 2),
                        'adx': round(latest['ADX'], 2),
                        'plus_di': round(latest['PLUS_DI'], 2),
                        'minus_di': round(latest['MINUS_DI'], 2),
                        'sma_50': round(latest['SMA_50'], 2)
                    }
                    if 'WEEKLY_MACD_HIST' in latest and not pd.isna(latest['WEEKLY_MACD_HIST']):
                        details[symbol]['weekly_macd'] = round(latest['WEEKLY_MACD_HIST'], 4)
            except Exception as e:
                print(f"Error screening {symbol} with trend following strategy: {str(e)}")
    
    # Williams %R Strategy - Identifies oversold and overbought conditions
    elif screen_type == 'williams':
        for symbol, df in data_dict.items():
            if df.empty or len(df) < 50:
                continue
                
            try:
                # Calculate Williams %R manually if not already in dataframe
                if 'WILLIAMS_R' not in df.columns:
                    # Williams %R is typically calculated over 14 periods
                    period = 14
                    highest_high = df['High'].rolling(period).max()
                    lowest_low = df['Low'].rolling(period).min()
                    williams_r = -100 * (highest_high - df['Close']) / (highest_high - lowest_low)
                    df['WILLIAMS_R'] = williams_r
                
                # Get most recent data point
                latest = df.iloc[-1]
                previous = df.iloc[-2]
                
                # Screen for bullish reversal from oversold
                oversold_level = -80
                was_oversold = previous['WILLIAMS_R'] < oversold_level
                reversing_up = latest['WILLIAMS_R'] > previous['WILLIAMS_R']
                
                # Confirm with trend
                above_sma = latest['Close'] > latest['SMA_20']
                
                # All criteria must be met
                if was_oversold and reversing_up and above_sma:
                    matches.append(symbol)
                    details[symbol] = {
                        'close': round(latest['Close'], 2),
                        'williams_r': round(latest['WILLIAMS_R'], 2),
                        'prev_williams_r': round(previous['WILLIAMS_R'], 2),
                        'sma_20': round(latest['SMA_20'], 2)
                    }
            except Exception as e:
                print(f"Error screening {symbol} with Williams %R strategy: {str(e)}")
    
    # Basic default screen if strategy not recognized
    else:
        for symbol, df in data_dict.items():
            if df.empty or len(df) < 20:
                continue
                
            try:
                # Basic criteria - price above 20-day moving average
                latest = df.iloc[-1]
                if latest['Close'] > latest['SMA_20']:
                    matches.append(symbol)
                    details[symbol] = {
                        'close': round(latest['Close'], 2),
                        'sma_20': round(latest['SMA_20'], 2)
                    }
            except Exception as e:
                print(f"Error screening {symbol} with basic strategy: {str(e)}")
    
    print(f"Found {len(matches)} matches out of {len(data_dict)} stocks")
    
    return {
        'matches': matches,
        'details': details
    }
`;
  }

  // Main execution block
  const mainExecution = `
# Import essential packages
import numpy as np
import pandas as pd

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
        source_content = """${screener.source.content}"""
        if 'def get_stock_universe(' in source_content:
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