
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
def screen_stocks(data_dict):
    """
    Screen stocks based on momentum criteria:
    - Price above 20-day moving average
    - RSI between 30 and 70
    - Positive momentum (MACD histogram > 0)
    - Volume above 20-day average
    """
    results = {}
    matches = []
    
    for symbol, df in data_dict.items():
        if df.empty or len(df) < 50:
            continue
            
        # Get the latest data point
        latest = df.iloc[-1]
        
        # Basic screening criteria
        above_sma = latest["Close"] > latest["SMA_20"]
        healthy_rsi = 30 < latest["RSI"] < 70
        positive_momentum = latest["MACD_Hist"] > 0
        high_volume = latest["Volume"] > latest["Volume_SMA_20"]
        
        # Combine criteria
        if above_sma and healthy_rsi and positive_momentum and high_volume:
            matches.append(symbol)
            results[symbol] = {
                "close": float(latest["Close"]),
                "sma_20": float(latest["SMA_20"]),
                "rsi": float(latest["RSI"]),
                "macd_hist": float(latest["MACD_Hist"]),
                "volume": float(latest["Volume"]),
                "volume_sma": float(latest["Volume_SMA_20"])
            }
    
    return {
        "matches": matches,
        "details": results
    }
# Main execution
if __name__ == "__main__":
    try:
        # Load configuration
        config = {"assets":["AAPL","MSFT","GOOGL","AMZN","META","TSLA","NVDA","AMD","INTC","NFLX"],"parameters":{"max_rsi":70,"min_rsi":30}}
        
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
            'screener_id': 1,
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
