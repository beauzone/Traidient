"""
Fixed Stock Screener with Standard Library Indicators
- Implements key technical analysis functionality
- Only uses standard Python libraries and installed packages
- Supports multiple screening strategies
"""

import pandas as pd
import numpy as np
import yfinance as yf
import json
import sys
import os
from datetime import datetime, timedelta
import warnings

# Suppress warnings
warnings.filterwarnings('ignore')

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
    """Calculate technical indicators for each dataframe"""
    for symbol, df in dataframes.items():
        if df.empty:
            continue
            
        try:
            # Simple Moving Averages
            df['SMA_20'] = df['Close'].rolling(window=20).mean()
            df['SMA_50'] = df['Close'].rolling(window=50).mean()
            df['SMA_200'] = df['Close'].rolling(window=200).mean()
            
            # Volume Moving Average
            df['Volume_SMA_20'] = df['Volume'].rolling(window=20).mean()
            
            # Relative Strength Index (RSI)
            delta = df['Close'].diff()
            gain = delta.where(delta > 0, 0).rolling(window=14).mean()
            loss = -delta.where(delta < 0, 0).rolling(window=14).mean()
            loss = loss.replace(0, 0.00001)  # Avoid division by zero
            rs = gain / loss
            df['RSI'] = 100 - (100 / (1 + rs))
            
            # Moving Average Convergence Divergence (MACD)
            df['EMA_12'] = df['Close'].ewm(span=12, adjust=False).mean()
            df['EMA_26'] = df['Close'].ewm(span=26, adjust=False).mean()
            df['MACD'] = df['EMA_12'] - df['EMA_26']
            df['MACD_Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()
            df['MACD_Hist'] = df['MACD'] - df['MACD_Signal']
            
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
                df['ADX'] = adx
                df['PLUS_DI'] = pos_di
                df['MINUS_DI'] = neg_di
            except Exception as e:
                print(f"Error calculating ADX for {symbol}: {str(e)}")
                df['ADX'] = np.nan
                df['PLUS_DI'] = np.nan
                df['MINUS_DI'] = np.nan
            
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
                    weekly_dates = macd_hist_weekly.index
                    weekly_values = macd_hist_weekly.values
                    
                    # Create a Series with the weekly values
                    weekly_series = pd.Series(index=weekly_dates, data=weekly_values)
                    # Reindex to daily values (forward fill)
                    daily_macd = weekly_series.reindex(df.index, method='ffill')
                    df['WEEKLY_MACD_HIST'] = daily_macd
                else:
                    df['WEEKLY_MACD_HIST'] = np.nan
            except Exception as e:
                print(f"Error calculating weekly indicators for {symbol}: {e}")
                df['WEEKLY_MACD_HIST'] = np.nan
                
        except Exception as e:
            print(f"Error calculating indicators for {symbol}: {str(e)}")
                
    return dataframes

def screen_stocks(data_dict, screen_type='momentum'):
    """
    Screen stocks based on selected strategy type
    Available strategies: 'momentum', 'trend_following', 'williams'
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
            if df.empty or len(df) < 30:
                continue
                
            try:
                # Get most recent data point
                latest = df.iloc[-1]
                
                # Screen criteria
                price_above_sma20 = latest['Close'] > latest['SMA_20']
                rsi_healthy = 30 < latest['RSI'] < 70
                positive_macd = latest['MACD_Hist'] > 0
                volume_above_avg = latest['Volume'] > latest['Volume_SMA_20']
                
                # All criteria must be met
                if price_above_sma20 and rsi_healthy and positive_macd and volume_above_avg:
                    matches.append(symbol)
                    details[symbol] = {
                        'close': round(latest['Close'], 2),
                        'sma_20': round(latest['SMA_20'], 2),
                        'rsi': round(latest['RSI'], 2),
                        'macd_hist': round(latest['MACD_Hist'], 4),
                        'volume_ratio': round(latest['Volume'] / latest['Volume_SMA_20'], 2)
                    }
            except Exception as e:
                print(f"Error screening {symbol}: {str(e)}")
    
    # Trend Following Strategy
    elif screen_type == 'trend_following':
        for symbol, df in data_dict.items():
            if df.empty or len(df) < 60:
                continue
                
            try:
                # Get most recent data
                latest = df.iloc[-1]
                
                # Trend criteria: price above longer-term MAs, ADX > 20 (strong trend)
                price_above_sma50 = latest['Close'] > latest['SMA_50']
                price_above_sma200 = latest['Close'] > latest['SMA_200']
                strong_trend = latest['ADX'] > 20
                trending_up = latest['PLUS_DI'] > latest['MINUS_DI']
                
                # Combined criteria
                if price_above_sma50 and price_above_sma200 and strong_trend and trending_up:
                    matches.append(symbol)
                    details[symbol] = {
                        'close': round(latest['Close'], 2),
                        'sma_50': round(latest['SMA_50'], 2),
                        'sma_200': round(latest['SMA_200'], 2),
                        'adx': round(latest['ADX'], 2),
                        'plus_di': round(latest['PLUS_DI'], 2),
                        'minus_di': round(latest['MINUS_DI'], 2)
                    }
            except Exception as e:
                print(f"Error screening {symbol} with trend following strategy: {str(e)}")
    
    # Williams %R Strategy
    elif screen_type == 'williams':
        for symbol, df in data_dict.items():
            if df.empty or len(df) < 30:
                continue
                
            try:
                # Calculate Williams %R
                highest_high = df['High'].rolling(window=14).max()
                lowest_low = df['Low'].rolling(window=14).min()
                df['WILLIAMS_R'] = -100 * (highest_high - df['Close']) / (highest_high - lowest_low)
                
                # Get recent data
                latest = df.iloc[-1]
                prev_5d = df.iloc[-6:-1]  # Previous 5 days
                
                # Williams %R oversold reversal (< -80 to > -50)
                was_oversold = (prev_5d['WILLIAMS_R'] < -80).any()
                now_recovering = latest['WILLIAMS_R'] > -50
                
                # Confirm with price action and volume
                price_above_sma20 = latest['Close'] > latest['SMA_20']
                volume_increasing = latest['Volume'] > latest['Volume_SMA_20']
                
                # Combined criteria - oversold to recovery
                if was_oversold and now_recovering and price_above_sma20 and volume_increasing:
                    matches.append(symbol)
                    details[symbol] = {
                        'close': round(latest['Close'], 2),
                        'williams_r': round(latest['WILLIAMS_R'], 2),
                        'min_williams_5d': round(prev_5d['WILLIAMS_R'].min(), 2),
                        'sma_20': round(latest['SMA_20'], 2),
                        'volume_ratio': round(latest['Volume'] / latest['Volume_SMA_20'], 2)
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
                print(f"Error in basic screening for {symbol}: {str(e)}")
    
    print(f"Found {len(matches)} matches out of {len(data_dict)} stocks")
    
    return {
        'matches': matches,
        'details': details
    }

if __name__ == "__main__":
    try:
        # Define list of major stocks to screen
        # Using a small list by default, but this should be expanded in production
        symbols = [
            'AAPL', 'MSFT', 'GOOG', 'AMZN', 'META', 'TSLA', 'NVDA', 'NFLX',
            'JPM', 'V', 'PYPL', 'BAC', 'DIS', 'CMCSA', 'HD', 'INTC', 'VZ',
            'ADBE', 'CSCO', 'PEP', 'XOM', 'CVX', 'WMT', 'PG', 'KO', 'MRK'
        ]
        
        # For comprehensive screening, we can use a larger universe
        # This section would typically use a data source or API to get a larger list
        try:
            import requests
            print("Attempting to fetch S&P 500 symbols from Wikipedia...")
            url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
            response = requests.get(url)
            if response.status_code == 200:
                # Extract table with S&P 500 constituents
                sp500_df = pd.read_html(response.text)[0]
                sp500_symbols = sp500_df['Symbol'].tolist()
                # Clean symbols (remove dots, adjust tickers)
                sp500_symbols = [s.replace('.', '-') for s in sp500_symbols]
                print(f"Successfully loaded {len(sp500_symbols)} S&P 500 symbols")
                symbols = sp500_symbols
            else:
                print("Failed to fetch S&P 500 symbols, using default list")
        except Exception as e:
            print(f"Error fetching S&P 500 list: {e}, using default symbols")
        
        # Load market data for the symbols
        print("Loading market data...")
        data = load_market_data(symbols, period='3mo')
        
        # Calculate technical indicators
        print("Calculating technical indicators...")
        data_with_indicators = calculate_technical_indicators(data)
        
        # Get screen type from parameters if provided, or use default
        screen_type = 'momentum'  # Default
        
        # Run the requested screening strategy
        print(f"Running '{screen_type}' screening strategy...")
        results = screen_stocks(data_with_indicators, screen_type=screen_type)
        
        # Display results
        print("\n============== SCREENING RESULTS ==============")
        if len(results['matches']) > 0:
            print(f"Found {len(results['matches'])} matching stocks:")
            for symbol in results['matches']:
                details = results['details'][symbol]
                details_str = ', '.join([f"{k}={v}" for k, v in details.items()])
                print(f"{symbol}: {details_str}")
        else:
            print("No stocks matched the screening criteria")
        
        # Return JSON results
        print(json.dumps({
            'success': True,
            'matches': results['matches'],
            'details': results['details'],
            'count': len(results['matches']),
            'timestamp': datetime.now().isoformat()
        }))
        
    except Exception as e:
        # Handle any unexpected errors
        error_message = f"Error in screener: {str(e)}"
        print(error_message)
        print(json.dumps({
            'success': False,
            'error': error_message,
            'matches': [],
            'details': {},
            'count': 0,
            'timestamp': datetime.now().isoformat()
        }))
        sys.exit(1)