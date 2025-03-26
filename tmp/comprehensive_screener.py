"""
Comprehensive Stock Screener with Advanced Technical Indicators
- Uses standard Python libraries instead of pandas_ta
- Implements advanced technical analysis functionality
- Supports multiple screening strategies
"""

import pandas as pd
import numpy as np
import yfinance as yf
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
        gain = delta.where(delta > 0, 0).rolling(window=14).mean()
        loss = -delta.where(delta < 0, 0).rolling(window=14).mean()
        
        # Handle division by zero
        loss = loss.replace(0, 0.00001)
        rs = gain / loss
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
        
        # Volume change
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
            print(f"Error calculating ADX indicators for {symbol}: {e}")
            result_df['PLUS_DI'] = float('nan')
            result_df['MINUS_DI'] = float('nan')
            result_df['ADX'] = float('nan')
        
        # Williams %R calculation
        highest_high = df['High'].rolling(window=14).max()
        lowest_low = df['Low'].rolling(window=14).min()
        result_df['WILLIAMS_R'] = -100 * (highest_high - df['Close']) / (highest_high - lowest_low)
        
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
            else:
                result_df['WEEKLY_MACD_HIST'] = pd.Series(index=df.index, data=np.nan)
        except Exception as e:
            print(f"Error calculating weekly indicators for {symbol}: {e}")
            result_df['WEEKLY_MACD_HIST'] = pd.Series(index=df.index, data=np.nan)
        
        # 12-month high/low
        result_df['MAX_12MO'] = df['Close'].rolling(253).max()
        result_df['MIN_12MO'] = df['Close'].rolling(253).min()
        
        # Cup and Handle pattern (custom implementation)
        result_df['CUP_HANDLE'] = detect_cup_and_handle(df)
        
        # Store results
        results[symbol] = result_df
        
    return results

def detect_cup_and_handle(df, lookback=90):
    """Detect cup and handle pattern in price data
    Simplified implementation focused on curvature detection
    """
    if len(df) < lookback:
        return pd.Series(False, index=df.index)
        
    result = pd.Series(False, index=df.index)
    
    for i in range(lookback, len(df)):
        try:
            # Look at a window of data
            window = df.iloc[i-lookback:i]
            
            # Need enough data
            if len(window) < lookback * 0.9:
                continue
                
            prices = window['Close'].values
            
            # Check if we have a cup shape
            # 1. Find the low point in the middle of the window
            split_point = len(prices) // 2
            first_half = prices[:split_point]
            second_half = prices[split_point:]
            
            # 2. Check if first half starts high, drops, second half rises back
            start_price = first_half[0]
            middle_price = min(prices[split_point-3:split_point+3])
            end_price = second_half[-1]
            
            # 3. Cup criteria - U shape
            cup_depth = (start_price - middle_price) / start_price
            recovery = (end_price - middle_price) / (start_price - middle_price)
            
            # 4. Start and end should be at similar levels for cup
            symmetry = abs(end_price - start_price) / start_price
            
            # 5. Handle criteria - small pullback and recovery
            if len(second_half) > 15:  # Need enough data for handle
                handle_section = second_half[-15:]
                handle_high = max(handle_section[:5])
                handle_low = min(handle_section[5:10])
                handle_end = handle_section[-1]
                handle_depth = (handle_high - handle_low) / handle_high
                handle_recovery = (handle_end - handle_low) / (handle_high - handle_low)
                
                # Cup and handle pattern found
                if (0.1 < cup_depth < 0.5 and  # Cup depth between 10-50%
                    recovery > 0.7 and         # Recovery > 70% of drop
                    symmetry < 0.1 and         # Start/end within 10%
                    0.03 < handle_depth < 0.15 and  # Small handle
                    handle_recovery > 0.5):    # Handle showing recovery
                    
                    result.iloc[i] = True
        except Exception as e:
            continue
    
    return result

def screen_stocks(data_dict, screen_type='momentum'):
    """
    Screen stocks based on selected strategy type
    Available strategies: 'momentum', 'technical', 'trend_following', 'custom', 'williams', 'cup_handle'
    """
    matches = []
    details = {}
    
    print(f"Running {screen_type} screen on {len(data_dict)} stocks")
    
    # Default screen type if not specified
    if not screen_type:
        screen_type = 'momentum'
    
    # Momentum Strategy Screen
    if screen_type == 'momentum':
        for symbol, df in data_dict.items():
            if df.empty or len(df) < 30:
                continue
                
            try:
                # Get most recent data
                latest = df.iloc[-1]
                
                # Basic momentum criteria
                price_above_sma20 = latest['Close'] > latest['SMA_20']
                rsi_healthy = 30 < latest['RSI'] < 70
                positive_macd = latest['MACD_Hist'] > 0
                volume_above_avg = latest['Volume'] > latest['Volume_SMA_20']
                
                # Combined criteria
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
                print(f"Error screening {symbol} with momentum strategy: {str(e)}")
    
    # Trend Following Strategy Screen
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
                
                # Weekly trend confirmation for additional strength
                weekly_trend = latest['WEEKLY_MACD_HIST'] > 0
                
                # Combined criteria
                if price_above_sma50 and price_above_sma200 and strong_trend and trending_up and weekly_trend:
                    matches.append(symbol)
                    details[symbol] = {
                        'close': round(latest['Close'], 2),
                        'sma_50': round(latest['SMA_50'], 2),
                        'sma_200': round(latest['SMA_200'], 2),
                        'adx': round(latest['ADX'], 2),
                        'plus_di': round(latest['PLUS_DI'], 2),
                        'minus_di': round(latest['MINUS_DI'], 2),
                        'weekly_macd': round(latest['WEEKLY_MACD_HIST'], 4)
                    }
            except Exception as e:
                print(f"Error screening {symbol} with trend following strategy: {str(e)}")
    
    # Williams %R Strategy
    elif screen_type == 'williams':
        for symbol, df in data_dict.items():
            if df.empty or len(df) < 30:
                continue
                
            try:
                # Get recent data - check for Williams %R reversal patterns
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
    
    # Cup and Handle Pattern Screen
    elif screen_type == 'cup_handle':
        for symbol, df in data_dict.items():
            if df.empty or len(df) < 100:
                continue
                
            try:
                # Check for cup and handle patterns in recent data
                recent_cup_handle = df['CUP_HANDLE'].iloc[-20:].any()
                
                # Additional confirmation filters
                latest = df.iloc[-1]
                price_above_sma50 = latest['Close'] > latest['SMA_50']
                volume_above_avg = latest['Volume'] > latest['Volume_SMA_20']
                
                if recent_cup_handle and price_above_sma50 and volume_above_avg:
                    matches.append(symbol)
                    # Find the exact cup and handle day
                    cup_days = df.iloc[-20:].loc[df['CUP_HANDLE'] == True].index
                    cup_day_str = cup_days[0].strftime('%Y-%m-%d') if len(cup_days) > 0 else 'Unknown'
                    
                    details[symbol] = {
                        'close': round(latest['Close'], 2),
                        'pattern_date': cup_day_str,
                        'sma_50': round(latest['SMA_50'], 2),
                        'volume_ratio': round(latest['Volume'] / latest['Volume_SMA_20'], 2)
                    }
            except Exception as e:
                print(f"Error screening {symbol} with cup and handle strategy: {str(e)}")
    
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
    # Define symbols to screen
    # Using a smaller list for faster testing/demo
    symbols = [
        'AAPL', 'MSFT', 'GOOG', 'AMZN', 'META', 'TSLA', 'NVDA', 'NFLX',
        'JPM', 'V', 'PYPL', 'BAC', 'DIS', 'CMCSA', 'HD', 'INTC', 'VZ',
        'ADBE', 'CSCO', 'PEP', 'XOM', 'CVX', 'WMT', 'PG', 'KO', 'MRK',
        'JNJ', 'UNH', 'HD', 'COST', 'CRM', 'AVGO', 'AMD', 'PFE', 'BMY',
        'ABBV', 'TMO', 'ABT', 'DHR', 'NKE', 'BABA', 'MMM', 'GS', 'MNST'
    ]
    
    # Load market data
    data = load_market_data(symbols, period='6mo')
    
    # Calculate indicators
    data_with_indicators = calculate_technical_indicators(data)
    
    # Run different screening strategies
    strategies = ['momentum', 'trend_following', 'williams', 'cup_handle']
    
    for strategy in strategies:
        print(f"\n===== {strategy.upper()} STRATEGY RESULTS =====")
        results = screen_stocks(data_with_indicators, screen_type=strategy)
        
        # Display results
        if len(results['matches']) > 0:
            print(f"\nFound {len(results['matches'])} matches:")
            for symbol in results['matches']:
                details = results['details'][symbol]
                details_str = ', '.join([f"{k}={v}" for k, v in details.items()])
                print(f"{symbol}: {details_str}")
        else:
            print("No matches found for this strategy.")