
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
# Using pandas_ta for advanced technical indicators

def calculate_advanced_indicators(df):
    """Calculate advanced technical indicators using pandas_ta"""
    try:
        import pandas_ta as ta
        
        # Make a copy to avoid modifying the original
        df_copy = df.copy()
        
        # Ichimoku Cloud
        ichimoku = ta.ichimoku(df_copy["High"], df_copy["Low"], df_copy["Close"])
        df_copy = df_copy.join(ichimoku["ISA_9"])
        df_copy = df_copy.join(ichimoku["ISB_26"])
        df_copy = df_copy.join(ichimoku["ITS_9"])
        df_copy = df_copy.join(ichimoku["IKS_26"])
        df_copy = df_copy.join(ichimoku["ICS_26"])
        
        # Elder Ray Index
        elder = ta.er(df_copy["High"], df_copy["Low"], df_copy["Close"])
        df_copy = df_copy.join(elder)
        
        # Squeeze Momentum
        squeeze = ta.squeeze(df_copy["High"], df_copy["Low"], df_copy["Close"])
        df_copy = df_copy.join(squeeze)
        
        return df_copy
    except ImportError:
        print("Warning: pandas_ta not available, using basic indicators")
        return df

def screen_stocks(data_dict):
    """Screen stocks using advanced technical indicators"""
    results = {}
    matches = []
    
    for symbol, df in data_dict.items():
        if df.empty or len(df) < 50:
            continue
            
        # Add advanced indicators
        df_advanced = calculate_advanced_indicators(df)
        
        # Skip if data frame does not have our indicators
        if not all(col in df_advanced.columns for col in ["ISA_9", "ISB_26", "ICS_26"]):
            continue
        
        latest = df_advanced.iloc[-1]
        
        # Ichimoku Cloud Strategy
        price_above_cloud = latest["Close"] > latest["ISA_9"] and latest["Close"] > latest["ISB_26"]
        conversion_above_base = latest["ITS_9"] > latest["IKS_26"]
        
        # Bullish squeeze momentum (if available)
        squeeze_momentum = False
        if "SQZ_20_2.0_20_1.5_2" in df_advanced.columns and "SQZ_ON" in df_advanced.columns:
            squeeze_momentum = latest["SQZ_20_2.0_20_1.5_2"] > 0 and latest["SQZ_ON"] == 1
            
        # Check if price is in uptrend (above 50-day MA)
        price_uptrend = latest["Close"] > latest["SMA_50"]
        
        # Volume confirmation
        volume_confirming = latest["Volume"] > latest["Volume_SMA_20"]
        
        # Combine criteria - need Ichimoku cloud bullish and either momentum or uptrend
        signal_strength = 0
        if price_above_cloud: signal_strength += 1
        if conversion_above_base: signal_strength += 1
        if squeeze_momentum: signal_strength += 1
        if price_uptrend: signal_strength += 1
        if volume_confirming: signal_strength += 1
        
        if signal_strength >= 3 and price_above_cloud:  # At least 3 conditions including price above cloud
            matches.append(symbol)
            results[symbol] = {
                "close": float(latest["Close"]),
                "signal_strength": signal_strength,
                "cloud_bullish": price_above_cloud,
                "conversion_bullish": conversion_above_base,
                "squeeze_momentum": squeeze_momentum,
                "uptrend": price_uptrend,
                "volume_confirming": volume_confirming
            }
    
    return {
        "matches": matches,
        "details": results
    }
# Main execution
if __name__ == "__main__":
    try:
        # Load configuration
        config = {"assets":["AAPL","MSFT","GOOGL","AMZN","META","TSLA","NVDA","AMD","INTC","NFLX","DIS","V","MA","JPM","BAC","WMT","TGT","COST","HD","LOW","XOM","CVX","COP","PFE","MRK","JNJ","ABBV","LLY","KO","PEP","MCD","SBUX"],"parameters":{"ichimoku_lookback":26}}
        
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
            'screener_id': 3,
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
