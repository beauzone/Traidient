
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
        
        # Volume Moving Average
        result_df['Volume_SMA_20'] = df['Volume'].rolling(window=20).mean()
        
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
import json
import sys
from datetime import datetime

def main():
    try:
        # Simple output with fixed data for testing
        results = {
            "success": True,
            "matches": ["AAPL", "MSFT", "GOOG"],
            "details": {
                "AAPL": {"price": 180.0, "sma20": 175.0, "rsi": 55.0},
                "MSFT": {"price": 360.0, "sma20": 350.0, "rsi": 60.0},
                "GOOG": {"price": 140.0, "sma20": 135.0, "rsi": 58.0}
            },
            "count": 3,
            "timestamp": datetime.now().isoformat()
        }
        
        print(json.dumps(results))
        return 0
    except Exception as e:
        error_message = "Error in screener: {}".format(str(e))
        print(error_message)
        
        print(json.dumps({
            "success": False,
            "error": error_message,
            "matches": [],
            "details": {},
            "count": 0,
            "timestamp": datetime.now().isoformat()
        }))
        
        return 1

if __name__ == "__main__":
    sys.exit(main())
# Import essential packages
import numpy as np
import pandas as pd

# Main execution
if __name__ == "__main__":
    try:
        # Load configuration
        config = {"universe":["AAPL","MSFT","GOOG"],"parameters":{}}
        
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
        source_content = """import json
import sys
from datetime import datetime

def main():
    try:
        # Simple output with fixed data for testing
        results = {
            "success": True,
            "matches": ["AAPL", "MSFT", "GOOG"],
            "details": {
                "AAPL": {"price": 180.0, "sma20": 175.0, "rsi": 55.0},
                "MSFT": {"price": 360.0, "sma20": 350.0, "rsi": 60.0},
                "GOOG": {"price": 140.0, "sma20": 135.0, "rsi": 58.0}
            },
            "count": 3,
            "timestamp": datetime.now().isoformat()
        }
        
        print(json.dumps(results))
        return 0
    except Exception as e:
        error_message = "Error in screener: {}".format(str(e))
        print(error_message)
        
        print(json.dumps({
            "success": False,
            "error": error_message,
            "matches": [],
            "details": {},
            "count": 0,
            "timestamp": datetime.now().isoformat()
        }))
        
        return 1

if __name__ == "__main__":
    sys.exit(main())"""
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
            'screener_id': 14,
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
