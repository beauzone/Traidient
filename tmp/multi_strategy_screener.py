"""
Multi-Strategy Stock Screener
- Implements multiple screening strategies: momentum, trend following, and Williams %R
- Uses standard Python libraries instead of pandas_ta
- Includes proper error handling and logging
- Returns detailed output for UI display
"""

import pandas as pd
import numpy as np
import yfinance as yf
import json
import sys
import os
from datetime import datetime, timedelta
import warnings
import random

# Suppress warnings to keep output clean
warnings.filterwarnings('ignore')

def get_sp500_symbols():
    """Get S&P 500 symbols from Wikipedia"""
    try:
        url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
        tables = pd.read_html(url)
        df = tables[0]
        symbols = df['Symbol'].tolist()
        # Clean symbols (replace dots with hyphens for tickers like BRK.B -> BRK-B)
        symbols = [s.replace('.', '-') for s in symbols]
        print(f"Successfully loaded {len(symbols)} S&P 500 symbols")
        return symbols
    except Exception as e:
        print(f"Error fetching S&P 500 symbols: {e}")
        return []

def get_nasdaq100_symbols():
    """Get NASDAQ-100 symbols"""
    try:
        url = "https://en.wikipedia.org/wiki/Nasdaq-100"
        tables = pd.read_html(url)
        # Find the right table (usually the first one with 'Ticker' column)
        for table in tables:
            if 'Ticker' in table.columns:
                symbols = table['Ticker'].tolist()
                print(f"Successfully loaded {len(symbols)} NASDAQ-100 symbols")
                return symbols
        return []
    except Exception as e:
        print(f"Error fetching NASDAQ-100 symbols: {e}")
        return []

def get_basic_symbols():
    """Return a fixed set of major US stocks"""
    return [
        'AAPL', 'MSFT', 'GOOG', 'AMZN', 'META', 'TSLA', 'NVDA', 'NFLX',
        'JPM', 'V', 'PYPL', 'BAC', 'DIS', 'CMCSA', 'HD', 'INTC', 'VZ',
        'ADBE', 'CSCO', 'PEP', 'XOM', 'CVX', 'WMT', 'PG', 'KO', 'MRK',
        'JNJ', 'UNH', 'HD', 'COST', 'CRM', 'AVGO', 'AMD', 'PFE', 'BMY',
        'ABBV', 'TMO', 'ABT', 'DHR', 'NKE', 'MMM', 'GS', 'MNST'
    ]

def load_stock_data(symbols, period='3mo', interval='1d'):
    """
    Load stock data for multiple symbols
    Parameters:
    - symbols: List of stock symbols
    - period: Data period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
    - interval: Data interval (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)
    """
    data = {}
    
    if isinstance(symbols, str):
        symbols = [symbols]
    
    print(f"Loading data for {len(symbols)} symbols with period={period}, interval={interval}")
    
    # Limit to 50 symbols for testing to avoid rate limits
    # In production, process all symbols in batches
    symbols_to_process = symbols[:50]
    
    for symbol in symbols_to_process:
        try:
            stock = yf.Ticker(symbol)
            df = stock.history(period=period, interval=interval)
            
            if df.empty:
                print(f"No data available for {symbol}")
                continue
            
            data[symbol] = df
            print(f"Loaded {len(df)} data points for {symbol}")
        except Exception as e:
            print(f"Error loading data for {symbol}: {str(e)}")
    
    print(f"Successfully loaded data for {len(data)} symbols")
    return data

def calculate_technical_indicators(data_dict):
    """
    Calculate technical indicators for each stock
    """
    processed_data = {}
    
    for symbol, df in data_dict.items():
        try:
            if df.empty or len(df) < 50:  # Need enough data points
                continue
            
            # Make a copy to avoid modifying the original
            result_df = df.copy()
            
            # Simple Moving Averages
            result_df['SMA_20'] = df['Close'].rolling(window=20).mean()
            result_df['SMA_50'] = df['Close'].rolling(window=50).mean()
            result_df['SMA_200'] = df['Close'].rolling(window=200).mean()
            
            # Exponential Moving Average
            result_df['EMA_20'] = df['Close'].ewm(span=20, adjust=False).mean()
            
            # Volume Moving Average
            result_df['Volume_SMA_20'] = df['Volume'].rolling(window=20).mean()
            
            # RSI Calculation
            delta = df['Close'].diff()
            gain = delta.where(delta > 0, 0).rolling(window=14).mean()
            loss = -delta.where(delta < 0, 0).rolling(window=14).mean()
            
            # Handle division by zero
            loss = loss.replace(0, 0.00001)
            rs = gain / loss
            result_df['RSI'] = 100 - (100 / (1 + rs))
            
            # MACD
            result_df['EMA_12'] = df['Close'].ewm(span=12, adjust=False).mean()
            result_df['EMA_26'] = df['Close'].ewm(span=26, adjust=False).mean()
            result_df['MACD'] = result_df['EMA_12'] - result_df['EMA_26']
            result_df['MACD_Signal'] = result_df['MACD'].ewm(span=9, adjust=False).mean()
            result_df['MACD_Hist'] = result_df['MACD'] - result_df['MACD_Signal']
            
            # Williams %R
            highest_high = df['High'].rolling(window=14).max()
            lowest_low = df['Low'].rolling(window=14).min()
            result_df['Williams_R'] = -100 * (highest_high - df['Close']) / (highest_high - lowest_low)
            
            # Bollinger Bands
            result_df['BB_Middle'] = result_df['SMA_20']
            result_df['BB_StdDev'] = df['Close'].rolling(window=20).std()
            result_df['BB_Upper'] = result_df['BB_Middle'] + 2 * result_df['BB_StdDev']
            result_df['BB_Lower'] = result_df['BB_Middle'] - 2 * result_df['BB_StdDev']
            
            # ADX and Directional Indicators
            try:
                # Calculate True Range
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
                result_df['ADX'] = adx
                result_df['PLUS_DI'] = pos_di
                result_df['MINUS_DI'] = neg_di
            except Exception as e:
                print(f"Error calculating ADX for {symbol}: {e}")
                result_df['ADX'] = np.nan
                result_df['PLUS_DI'] = np.nan
                result_df['MINUS_DI'] = np.nan
            
            # Weekly MACD calculation (for trend confirmation)
            try:
                # Resample to weekly data
                df_weekly = df.resample('W-FRI').last()
                if len(df_weekly) > 30:  # Need enough weekly data points
                    ema_12_weekly = df_weekly['Close'].ewm(span=12, adjust=False).mean()
                    ema_26_weekly = df_weekly['Close'].ewm(span=26, adjust=False).mean()
                    weekly_macd = ema_12_weekly - ema_26_weekly
                    weekly_signal = weekly_macd.ewm(span=9, adjust=False).mean()
                    weekly_hist = weekly_macd - weekly_signal
                    
                    # Map weekly values back to daily dataframe (forward fill)
                    weekly_series = pd.Series(index=weekly_hist.index, data=weekly_hist.values)
                    daily_weekly_macd = weekly_series.reindex(df.index, method='ffill')
                    result_df['Weekly_MACD_Hist'] = daily_weekly_macd
                else:
                    result_df['Weekly_MACD_Hist'] = np.nan
            except Exception as e:
                print(f"Error calculating weekly MACD for {symbol}: {e}")
                result_df['Weekly_MACD_Hist'] = np.nan
            
            # Store the processed dataframe
            processed_data[symbol] = result_df
            
        except Exception as e:
            print(f"Error calculating indicators for {symbol}: {str(e)}")
    
    return processed_data

def screen_stocks(data_dict, strategy='momentum'):
    """
    Screen stocks according to the selected strategy.
    Available strategies:
    - momentum: Price > SMA20, 30 < RSI < 70, MACD Histogram > 0, Volume > SMA20
    - trend_following: Price > SMA50 & SMA200, ADX > 20, PLUS_DI > MINUS_DI
    - williams: Oversold to recovery pattern using Williams %R
    """
    matches = []
    details = {}
    
    print(f"Running {strategy} screen on {len(data_dict)} stocks")
    
    # Momentum Strategy
    if strategy == 'momentum':
        for symbol, df in data_dict.items():
            try:
                # Need enough data
                if df.empty or len(df) < 30:
                    continue
                
                # Get most recent data
                latest = df.iloc[-1]
                
                # Price must be above 20-day moving average
                if pd.isna(latest['SMA_20']) or pd.isna(latest['RSI']) or pd.isna(latest['MACD_Hist']):
                    continue
                
                # Screen criteria
                price_above_sma20 = latest['Close'] > latest['SMA_20']
                rsi_healthy = 30 < latest['RSI'] < 70
                macd_positive = latest['MACD_Hist'] > 0
                volume_above_avg = latest['Volume'] > latest['Volume_SMA_20']
                
                # Apply all criteria
                if price_above_sma20 and rsi_healthy and macd_positive and volume_above_avg:
                    matches.append(symbol)
                    details[symbol] = {
                        'price': float(latest['Close']),
                        'sma20': float(latest['SMA_20']),
                        'rsi': float(latest['RSI']),
                        'macd_hist': float(latest['MACD_Hist']),
                        'volume_ratio': float(latest['Volume'] / latest['Volume_SMA_20'])
                    }
            except Exception as e:
                print(f"Error screening {symbol} with momentum strategy: {e}")
    
    # Trend Following Strategy
    elif strategy == 'trend_following':
        for symbol, df in data_dict.items():
            try:
                # Need enough data
                if df.empty or len(df) < 60:
                    continue
                
                # Get most recent data
                latest = df.iloc[-1]
                
                # Check for missing values
                if (pd.isna(latest['SMA_50']) or pd.isna(latest['SMA_200']) or 
                    pd.isna(latest['ADX']) or pd.isna(latest['PLUS_DI']) or pd.isna(latest['MINUS_DI'])):
                    continue
                
                # Screen criteria
                price_above_sma50 = latest['Close'] > latest['SMA_50']
                price_above_sma200 = latest['Close'] > latest['SMA_200']
                strong_trend = latest['ADX'] > 20
                trending_up = latest['PLUS_DI'] > latest['MINUS_DI']
                
                # Weekly trend confirmation if available
                weekly_trend_positive = True
                if not pd.isna(latest.get('Weekly_MACD_Hist', None)):
                    weekly_trend_positive = latest['Weekly_MACD_Hist'] > 0
                
                # Apply all criteria
                if price_above_sma50 and price_above_sma200 and strong_trend and trending_up and weekly_trend_positive:
                    matches.append(symbol)
                    details[symbol] = {
                        'price': float(latest['Close']),
                        'sma50': float(latest['SMA_50']),
                        'sma200': float(latest['SMA_200']),
                        'adx': float(latest['ADX']),
                        'plus_di': float(latest['PLUS_DI']),
                        'minus_di': float(latest['MINUS_DI'])
                    }
                    # Add weekly MACD if available
                    if not pd.isna(latest.get('Weekly_MACD_Hist', None)):
                        details[symbol]['weekly_macd_hist'] = float(latest['Weekly_MACD_Hist'])
            except Exception as e:
                print(f"Error screening {symbol} with trend following strategy: {e}")
    
    # Williams %R Strategy
    elif strategy == 'williams':
        for symbol, df in data_dict.items():
            try:
                # Need enough data
                if df.empty or len(df) < 30:
                    continue
                
                # Get recent data
                latest = df.iloc[-1]
                prev_5d = df.iloc[-6:-1]  # Previous 5 days
                
                # Check for missing values
                if pd.isna(latest['Williams_R']) or pd.isna(latest['SMA_20']):
                    continue
                
                # Williams %R oversold to recovery pattern
                was_oversold = (prev_5d['Williams_R'] < -80).any()
                now_recovering = latest['Williams_R'] > -50
                
                # Confirm with price action and volume
                price_above_sma20 = latest['Close'] > latest['SMA_20']
                volume_increasing = latest['Volume'] > latest['Volume_SMA_20']
                
                # Apply all criteria
                if was_oversold and now_recovering and price_above_sma20 and volume_increasing:
                    matches.append(symbol)
                    details[symbol] = {
                        'price': float(latest['Close']),
                        'williams_r': float(latest['Williams_R']),
                        'min_williams_5d': float(prev_5d['Williams_R'].min()),
                        'sma20': float(latest['SMA_20']),
                        'volume_ratio': float(latest['Volume'] / latest['Volume_SMA_20'])
                    }
            except Exception as e:
                print(f"Error screening {symbol} with Williams %R strategy: {e}")
    
    # Basic screen if no strategy recognized (default to above 20-day moving average)
    else:
        print(f"Strategy '{strategy}' not recognized. Using basic price > SMA20 screen.")
        for symbol, df in data_dict.items():
            try:
                # Need enough data
                if df.empty or len(df) < 20:
                    continue
                
                # Get most recent data
                latest = df.iloc[-1]
                
                # Skip if SMA20 is not available
                if pd.isna(latest['SMA_20']):
                    continue
                
                # Basic criteria - price above 20-day moving average
                if latest['Close'] > latest['SMA_20']:
                    matches.append(symbol)
                    details[symbol] = {
                        'price': float(latest['Close']),
                        'sma20': float(latest['SMA_20'])
                    }
            except Exception as e:
                print(f"Error in basic screening for {symbol}: {e}")
    
    print(f"Found {len(matches)} stocks matching {strategy} criteria")
    return {
        'matches': matches,
        'details': details
    }

def main():
    try:
        # First, try to get S&P 500 symbols
        sp500 = get_sp500_symbols()
        
        # If S&P 500 failed, try NASDAQ-100
        if not sp500:
            nasdaq100 = get_nasdaq100_symbols()
            symbols = nasdaq100 if nasdaq100 else get_basic_symbols()
        else:
            symbols = sp500
        
        if len(symbols) == 0:
            print("No symbols available for screening")
            sys.exit(1)
        
        # Load stock data
        print(f"Loading data for {len(symbols)} symbols...")
        stock_data = load_stock_data(symbols, period='3mo')
        
        if len(stock_data) == 0:
            print("Failed to load any stock data")
            sys.exit(1)
            
        # Calculate technical indicators
        print("Calculating technical indicators...")
        data_with_indicators = calculate_technical_indicators(stock_data)
        
        if len(data_with_indicators) == 0:
            print("No data after calculating indicators")
            sys.exit(1)
        
        # Run all three screening strategies
        print("Running multiple screening strategies...")
        
        momentum_results = screen_stocks(data_with_indicators, strategy='momentum')
        trend_results = screen_stocks(data_with_indicators, strategy='trend_following')
        williams_results = screen_stocks(data_with_indicators, strategy='williams')
        
        # Combine results into a comprehensive output
        all_results = {
            'success': True,
            'momentum': {
                'matches': momentum_results['matches'],
                'details': momentum_results['details'],
                'count': len(momentum_results['matches'])
            },
            'trend_following': {
                'matches': trend_results['matches'],
                'details': trend_results['details'],
                'count': len(trend_results['matches'])
            },
            'williams': {
                'matches': williams_results['matches'],
                'details': williams_results['details'],
                'count': len(williams_results['matches'])
            },
            'timestamp': datetime.now().isoformat()
        }
        
        # Display summary results
        print("\n===== SCREENING RESULTS SUMMARY =====")
        print(f"Momentum strategy: {len(momentum_results['matches'])} matches")
        print(f"Trend Following strategy: {len(trend_results['matches'])} matches")
        print(f"Williams %R strategy: {len(williams_results['matches'])} matches")
        
        # Print example matches for each strategy
        if momentum_results['matches']:
            print("\nTop Momentum Stocks:")
            for symbol in momentum_results['matches'][:5]:
                details = momentum_results['details'][symbol]
                print(f"  {symbol}: Price=${details['price']:.2f}, RSI={details['rsi']:.2f}")
        
        if trend_results['matches']:
            print("\nTop Trend Following Stocks:")
            for symbol in trend_results['matches'][:5]:
                details = trend_results['details'][symbol]
                print(f"  {symbol}: Price=${details['price']:.2f}, ADX={details['adx']:.2f}")
        
        if williams_results['matches']:
            print("\nTop Williams %R Stocks:")
            for symbol in williams_results['matches'][:5]:
                details = williams_results['details'][symbol]
                print(f"  {symbol}: Price=${details['price']:.2f}, Williams %R={details['williams_r']:.2f}")
        
        # Output JSON result
        print(json.dumps(all_results))
        
        return 0
        
    except Exception as e:
        error_message = f"Error in screener: {str(e)}"
        print(error_message)
        
        # Return error JSON
        print(json.dumps({
            'success': False,
            'error': error_message,
            'momentum': {'matches': [], 'details': {}, 'count': 0},
            'trend_following': {'matches': [], 'details': {}, 'count': 0},
            'williams': {'matches': [], 'details': {}, 'count': 0},
            'timestamp': datetime.now().isoformat()
        }))
        
        return 1

if __name__ == "__main__":
    sys.exit(main())