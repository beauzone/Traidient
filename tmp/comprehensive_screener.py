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
import talib
from scipy import signal

def load_market_data(symbols, period='3mo', interval='1d'):
    """Load market data for multiple symbols using yfinance"""
    print(f"Loading data for {len(symbols)} symbols with period {period}, interval {interval}...")
    
    data = {}
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
        if df.empty or len(df) < 50:  # Need enough data for indicators
            continue
            
        try:
            result_df = df.copy()
            
            # Moving Averages
            result_df['SMA_20'] = df['Close'].rolling(window=20).mean()
            result_df['SMA_50'] = df['Close'].rolling(window=50).mean()
            result_df['SMA_200'] = df['Close'].rolling(window=200).mean()
            
            # Exponential Moving Averages
            result_df['EMA_12'] = df['Close'].ewm(span=12, adjust=False).mean()
            result_df['EMA_26'] = df['Close'].ewm(span=26, adjust=False).mean()
            
            # RSI Calculation
            delta = df['Close'].diff()
            gain = delta.where(delta > 0, 0)
            loss = -delta.where(delta < 0, 0)
            avg_gain = gain.rolling(window=14).mean()
            avg_loss = loss.rolling(window=14).mean()
            avg_loss = avg_loss.replace(0, 0.00001)  # Avoid division by zero
            rs = avg_gain / avg_loss
            result_df['RSI'] = 100 - (100 / (1 + rs))
            
            # MACD Calculation
            result_df['MACD'] = result_df['EMA_12'] - result_df['EMA_26']
            result_df['MACD_Signal'] = result_df['MACD'].ewm(span=9, adjust=False).mean()
            result_df['MACD_Hist'] = result_df['MACD'] - result_df['MACD_Signal']
            
            # Bollinger Bands (20, 2)
            sma20 = df['Close'].rolling(window=20).mean()
            std20 = df['Close'].rolling(window=20).std()
            result_df['BB_Upper'] = sma20 + (std20 * 2)
            result_df['BB_Middle'] = sma20
            result_df['BB_Lower'] = sma20 - (std20 * 2)
            
            # Average True Range (ATR)
            high_low = df['High'] - df['Low']
            high_close = (df['High'] - df['Close'].shift(1)).abs()
            low_close = (df['Low'] - df['Close'].shift(1)).abs()
            true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
            result_df['ATR'] = true_range.rolling(window=14).mean()
            
            # Volume-based indicators
            result_df['Volume_SMA_20'] = df['Volume'].rolling(window=20).mean()
            
            # Stochastic Oscillator
            low_min = df['Low'].rolling(window=14).min()
            high_max = df['High'].rolling(window=14).max()
            result_df['%K'] = 100 * ((df['Close'] - low_min) / (high_max - low_min))
            result_df['%D'] = result_df['%K'].rolling(window=3).mean()
            
            # ADX, +DI, -DI (Directional Movement Index)
            # Calculate True Range (TR)
            tr1 = df['High'] - df['Low']
            tr2 = (df['High'] - df['Close'].shift(1)).abs()
            tr3 = (df['Low'] - df['Close'].shift(1)).abs()
            tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
            
            # Calculate Directional Movement
            pos_dm = df['High'] - df['High'].shift(1)
            neg_dm = df['Low'].shift(1) - df['Low']
            pos_dm = pos_dm.where((pos_dm > 0) & (pos_dm > neg_dm), 0)
            neg_dm = neg_dm.where((neg_dm > 0) & (neg_dm > pos_dm), 0)
            
            # Smooth with Wilder's smoothing technique - 14 period
            period = 14
            atr = tr.rolling(window=period).mean()  # Simple for now
            pos_di = 100 * (pos_dm.rolling(window=period).mean() / atr)
            neg_di = 100 * (neg_dm.rolling(window=period).mean() / atr)
            
            # Calculate DX and ADX
            dx = 100 * ((pos_di - neg_di).abs() / (pos_di + neg_di))
            adx = dx.rolling(window=period).mean()  # Smoothed DX is ADX
            
            result_df['+DI'] = pos_di
            result_df['-DI'] = neg_di
            result_df['ADX'] = adx
            
            # Weekly resampling for weekly indicators
            weekly_df = df.resample('W-FRI').last()
            
            # Weekly MACD
            weekly_ema12 = weekly_df['Close'].ewm(span=12, adjust=False).mean()
            weekly_ema26 = weekly_df['Close'].ewm(span=26, adjust=False).mean()
            weekly_macd = weekly_ema12 - weekly_ema26
            
            # Map weekly values back to daily dataframe
            weekly_dates = weekly_df.index
            
            # Initialize columns for weekly indicators
            result_df['Weekly_MACD'] = np.nan
            
            # For each week, assign the weekly value to all days in that week
            for i in range(len(weekly_dates)):
                if i < len(weekly_dates) - 1:
                    mask = (result_df.index >= weekly_dates[i]) & (result_df.index < weekly_dates[i+1])
                else:
                    mask = result_df.index >= weekly_dates[i]
                
                result_df.loc[mask, 'Weekly_MACD'] = weekly_macd.iloc[i]
            
            # Store results
            results[symbol] = result_df
            
        except Exception as e:
            print(f"Error calculating indicators for {symbol}: {str(e)}")
    
    return results

def detect_cup_and_handle(df, lookback=90):
    """Detect cup and handle pattern in price data
    Simplified implementation focused on curvature detection
    """
    if len(df) < lookback:
        return False, {}
    
    try:
        # Get closing prices for the lookback period
        close_prices = df['Close'].values[-lookback:]
        
        # Smooth prices to reduce noise
        window_size = 5
        smoothed_prices = np.convolve(close_prices, np.ones(window_size)/window_size, mode='valid')
        
        # Find price peaks and troughs
        peaks, _ = signal.find_peaks(smoothed_prices)
        troughs, _ = signal.find_peaks(-smoothed_prices)
        
        if len(peaks) < 2 or len(troughs) < 1:
            return False, {}
        
        # Cup pattern: Left peak -> trough -> right peak
        left_peaks = peaks[peaks < troughs[-1]]
        right_peaks = peaks[peaks > troughs[-1]]
        
        if len(left_peaks) == 0 or len(right_peaks) == 0:
            return False, {}
        
        left_peak_idx = left_peaks[-1]
        trough_idx = troughs[-1]
        right_peak_idx = right_peaks[0]
        
        # Check if the pattern forms a cup (U-shape)
        left_height = smoothed_prices[left_peak_idx] - smoothed_prices[trough_idx]
        right_height = smoothed_prices[right_peak_idx] - smoothed_prices[trough_idx]
        
        # Cup criteria: Similar heights on both sides, sufficient depth
        cup_ratio = min(left_height, right_height) / max(left_height, right_height)
        cup_depth = min(left_height, right_height) / smoothed_prices[trough_idx]
        
        is_cup = (cup_ratio > 0.6) and (cup_depth > 0.05) and (right_peak_idx - left_peak_idx > 15)
        
        # Look for handle formation (smaller decline after right peak)
        handle_detected = False
        handle_depth = 0
        if is_cup and len(smoothed_prices) > right_peak_idx + 5:
            handle_section = smoothed_prices[right_peak_idx:]
            if len(handle_section) > 5:
                handle_min = np.min(handle_section)
                handle_depth = (smoothed_prices[right_peak_idx] - handle_min) / smoothed_prices[right_peak_idx]
                
                # Handle should be smaller than cup and not too shallow
                handle_detected = (handle_depth < cup_depth) and (handle_depth > 0.02)
        
        pattern_detected = is_cup and handle_detected
        
        details = {
            'cup_detected': is_cup,
            'handle_detected': handle_detected,
            'cup_depth': cup_depth,
            'handle_depth': handle_depth,
            'cup_ratio': cup_ratio
        }
        
        return pattern_detected, details
    
    except Exception as e:
        print(f"Error detecting cup and handle pattern: {str(e)}")
        return False, {}

def screen_stocks(data_dict, screen_type='momentum'):
    """Screen stocks based on selected strategy type
    Available strategies: 'momentum', 'technical', 'trend_following', 'custom', 'williams', 'cup_handle'
    """
    results = {}
    matches = []
    details = {}
    
    print(f"Running {screen_type} screen on {len(data_dict)} stocks")
    
    # Momentum Strategy Screen
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
    
    # Technical Screen
    elif screen_type == 'technical':
        for symbol, df in data_dict.items():
            if df.empty or len(df) < 50:
                continue
                
            try:
                # Get most recent data points
                latest = df.iloc[-1]
                
                # Screen criteria
                golden_cross = (latest['SMA_50'] > latest['SMA_200']) and (df.iloc[-20]['SMA_50'] < df.iloc[-20]['SMA_200'])
                bullish_rsi = 40 < latest['RSI'] < 60  # Not overbought or oversold
                near_support = 0.9 < (latest['Close'] / latest['BB_Lower']) < 1.1  # Near lower BB
                increasing_adx = latest['ADX'] > 25 and latest['ADX'] > df.iloc[-5]['ADX']
                
                # All criteria must be met
                if golden_cross and bullish_rsi and near_support and increasing_adx:
                    matches.append(symbol)
                    details[symbol] = {
                        'close': round(latest['Close'], 2),
                        'sma_50': round(latest['SMA_50'], 2),
                        'sma_200': round(latest['SMA_200'], 2),
                        'rsi': round(latest['RSI'], 2),
                        'adx': round(latest['ADX'], 2)
                    }
            except Exception as e:
                print(f"Error screening {symbol} with technical strategy: {str(e)}")
    
    # Trend Following Screen
    elif screen_type == 'trend_following':
        for symbol, df in data_dict.items():
            if df.empty or len(df) < 50:
                continue
                
            try:
                # Get most recent data point
                latest = df.iloc[-1]
                
                # Screen criteria
                uptrend = latest['Close'] > latest['SMA_50'] > latest['SMA_200']
                strong_momentum = latest['MACD'] > latest['MACD_Signal'] > 0
                strong_directional = latest['ADX'] > 25
                positive_di = latest['+DI'] > latest['-DI']
                
                # All criteria must be met
                if uptrend and strong_momentum and strong_directional and positive_di:
                    matches.append(symbol)
                    details[symbol] = {
                        'close': round(latest['Close'], 2),
                        'sma_50': round(latest['SMA_50'], 2),
                        'sma_200': round(latest['SMA_200'], 2),
                        'adx': round(latest['ADX'], 2),
                        'plus_di': round(latest['+DI'], 2),
                        'minus_di': round(latest['-DI'], 2)
                    }
            except Exception as e:
                print(f"Error screening {symbol} with trend following strategy: {str(e)}")
    
    # Williams ADX Screen (based on user's sophisticated screening strategy)
    elif screen_type == 'williams':
        for symbol, df in data_dict.items():
            if df.empty or len(df) < 200:
                continue
                
            try:
                # Get most recent data points
                latest = df.iloc[-1]
                
                # Screen criteria based on user's strategy
                price_above_sma18 = latest['Close'] > latest['SMA_20']  # Using SMA_20 as proxy for SMA_18
                adx_above_25 = latest['ADX'] > 25
                plus_di_above_minus = latest['+DI'] > latest['-DI']
                weekly_macd_positive = latest['Weekly_MACD'] > 0
                volume_above_avg = latest['Volume'] > latest['Volume_SMA_20']
                
                # Additional criteria
                mfi_healthy = 30 < latest['RSI'] < 70  # Using RSI as proxy for MFI
                
                # All criteria must be met
                if (price_above_sma18 and adx_above_25 and plus_di_above_minus 
                    and weekly_macd_positive and volume_above_avg and mfi_healthy):
                    matches.append(symbol)
                    details[symbol] = {
                        'close': round(latest['Close'], 2),
                        'sma_18': round(latest['SMA_20'], 2),  # Using SMA_20 as proxy
                        'adx': round(latest['ADX'], 2),
                        'plus_di': round(latest['+DI'], 2),
                        'minus_di': round(latest['-DI'], 2),
                        'weekly_macd': round(latest['Weekly_MACD'], 4),
                        'volume_ratio': round(latest['Volume'] / latest['Volume_SMA_20'], 2)
                    }
            except Exception as e:
                print(f"Error screening {symbol} with Williams strategy: {str(e)}")
    
    # Cup and Handle Pattern Screen
    elif screen_type == 'cup_handle':
        for symbol, df in data_dict.items():
            if df.empty or len(df) < 90:
                continue
                
            try:
                # Detect cup and handle pattern
                pattern_detected, pattern_details = detect_cup_and_handle(df)
                
                # Additional confirmation filters
                if pattern_detected:
                    latest = df.iloc[-1]
                    
                    # Confirm with other indicators
                    uptrend = latest['Close'] > latest['SMA_50']
                    healthy_volume = latest['Volume'] > latest['Volume_SMA_20'] * 0.8
                    
                    if uptrend and healthy_volume:
                        matches.append(symbol)
                        details[symbol] = {
                            'close': round(latest['Close'], 2),
                            'cup_depth': round(pattern_details['cup_depth'], 4),
                            'handle_depth': round(pattern_details['handle_depth'], 4),
                            'volume_ratio': round(latest['Volume'] / latest['Volume_SMA_20'], 2)
                        }
            except Exception as e:
                print(f"Error screening {symbol} for cup and handle: {str(e)}")
    
    # Custom Screen (multipurpose)
    elif screen_type == 'custom':
        for symbol, df in data_dict.items():
            if df.empty or len(df) < 50:
                continue
                
            try:
                # Get most recent data points
                latest = df.iloc[-1]
                
                # Example custom criteria - modify as needed
                price_above_ema = latest['Close'] > latest['EMA_26']
                volume_spike = latest['Volume'] > latest['Volume_SMA_20'] * 1.5
                bullish_stoch = latest['%K'] > latest['%D'] and latest['%K'] < 80
                
                # All criteria must be met
                if price_above_ema and volume_spike and bullish_stoch:
                    matches.append(symbol)
                    details[symbol] = {
                        'close': round(latest['Close'], 2),
                        'ema_26': round(latest['EMA_26'], 2),
                        'volume_ratio': round(latest['Volume'] / latest['Volume_SMA_20'], 2),
                        'stoch_k': round(latest['%K'], 2),
                        'stoch_d': round(latest['%D'], 2)
                    }
            except Exception as e:
                print(f"Error screening {symbol} with custom strategy: {str(e)}")
    
    print(f"Found {len(matches)} matches out of {len(data_dict)} stocks")
    
    return {
        'matches': matches,
        'details': details
    }

if __name__ == "__main__":
    print(f"Running test screen at {datetime.now()}")
    
    # Test with a list of popular stocks
    test_symbols = [
        "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "JPM", "V", "JNJ", "PG",
        "XOM", "BAC", "WMT", "UNH", "MA", "HD", "CVX", "LLY", "MRK", "KO",
        "PEP", "AVGO", "PFE", "COST", "ABBV", "TMO", "ORCL", "ACN", "META", "MCD"
    ]
    print(f"Testing with {len(test_symbols)} symbols: {test_symbols}")
    
    # Load market data with more history (3 months)
    data_dict = load_market_data(test_symbols, period='6mo', interval='1d')
    
    # Calculate technical indicators
    data_with_indicators = calculate_technical_indicators(data_dict)
    
    # Test multiple screening strategies
    all_results = {}
    
    for strategy in ['momentum', 'technical', 'trend_following', 'williams', 'cup_handle', 'custom']:
        print(f"\nTesting {strategy} strategy:")
        strategy_results = screen_stocks(data_with_indicators, screen_type=strategy)
        all_results[strategy] = strategy_results
        
        # Print results
        print(f"Matches ({len(strategy_results['matches'])}):")
        for symbol in strategy_results['matches']:
            details = strategy_results['details'][symbol]
            details_str = ', '.join([f"{k}: {v}" for k, v in details.items()])
            print(f"{symbol}: {details_str}")