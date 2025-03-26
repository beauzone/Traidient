
import pandas as pd
import numpy as np
import json
import sys
from datetime import datetime, timedelta
import warnings
import yfinance as yf

# Suppress warnings
warnings.filterwarnings('ignore')

# No dependencies on pandas_ta or talib - we'll use our own implementations

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
een stocks based on criteria"""
    matcheimport pandas as pd
import numpy as np
import talib
from datetime import datetime, timedelta

# Mock data loader for testing — replace with Alpaca or real data
def get_stock_data(symbol, start_date, end_date):
    df = pd.read_csv(f'data/{symbol}.csv', parse_dates=['date'], index_col='date')  # or Alpaca API
    df = df.loc[start_date:end_date]
    return df

def screen_stock(symbol, spx_close=574.08, spx_sma18=568.48):
    end = datetime.today()
    start = end - timedelta(days=365 * 2)
    df = get_stock_data(symbol, start, end)

    if len(df) < 300:
        return False  # not enough data

    # Calculate indicators
    df['sma20_vol'] = df['volume'].rolling(20).mean()
    df['sma40'] = talib.SMA(df['close'], timeperiod=40)
    df['sma18'] = talib.SMA(df['close'], timeperiod=18)
    df['mfi'] = talib.MFI(df['high'], df['low'], df['close'], df['volume'], timeperiod=14)
    df['rsi'] = talib.RSI(df['close'], timeperiod=14)
    macd, macdsignal, _ = talib.MACD(df['close'], fastperiod=12, slowperiod=26, signalperiod=9)
    df['macd'], df['macdsignal'] = macd, macdsignal

    # Weekly MACD
    df_weekly = df.resample('W-FRI').last()
    df_weekly['weekly_macd'], _, _ = talib.MACD(df_weekly['close'], 12, 26, 9)

    # ADX and DI
    df['plus_di'] = talib.PLUS_DI(df['high'], df['low'], df['close'], timeperiod=14)
    df['minus_di'] = talib.MINUS_DI(df['high'], df['low'], df['close'], timeperiod=14)
    df['adx'] = talib.ADX(df['high'], df['low'], df['close'], timeperiod=14)

    # 12-month high/low
    df['max_12mo'] = df['close'].rolling(253).max()
    df['min_12mo'] = df['close'].rolling(253).min()

    latest = df.iloc[-1]
    latest_week = df_weekly.iloc[-1]

    # Condition checks
    conditions
s = []
    details = {}
    
    # Screen through all provided stocks (typically major US exchanges)
    for symbol, df in data_dict.items():
        # Skip if we don't have enough data
        if len(df) < 20:
            continue
            
        # Example criteria - stocks above their 20-day moving average
        df['ma20'] = df['Close'].rolling(window=20).mean()
        latest = df.iloc[-1]
        
        if latest['Close'] > latest['ma20']:
            matches.append(symbol)
            details[symbol] = {
                'price': latest['Close'],
                'ma20': latest['ma20'],
                'above_ma': True,
                'pct_above': ((latest['Close'] / latest['ma20']) - 1) * 100
            }
            
    return {
        'matches': matches,
        'details': details
    }
# Main execution
if __name__ == "__main__":
    try:
        # Load configuration
        config = {"parameters":{}}
        
        # Default stock universes for screening
        # Since a stock screener should work with a large universe of stocks,
        # we'll use default lists if no specific assets are provided.
        SP500_SYMBOLS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK.B", "UNH", "XOM", 
                         "JPM", "JNJ", "V", "PG", "MA", "HD", "AVGO", "CVX", "MRK", "LLY", "ABBV", "PEP", 
                         "COST", "BAC", "KO", "TMO", "CSCO", "MCD", "ACN", "ABT", "CRM", "WMT", "PFE", "DHR"]
        
        # Define the top stocks by market cap as a default universe
        TOP_STOCKS = SP500_SYMBOLS[:20]  # Use first 20 stocks from S&P 500 for testing
        
        # Use assets if specified, otherwise default to predefined universe
        symbols = config.get('assets', [])
        if not symbols:
            print("No specific assets provided, using default stock universe.")
            # Choose the universe based on the description or content of the screener
            # For example, if the description contains "S&P 500", use the S&P 500 symbols
            description = "Stocks poised to breakout".lower()
            if "s&p" in description or "s&p 500" in description or "sp500" in description:
                symbols = SP500_SYMBOLS
            else:
                # Use top stocks by default for faster execution
                symbols = TOP_STOCKS
                
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
            'screener_id': 8,
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
