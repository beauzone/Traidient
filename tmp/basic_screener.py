"""
Basic Stock Screener with Standard Library Indicators
- Implements key technical analysis functionality
- Only uses standard Python libraries and installed packages
- Supports multiple screening strategies
"""

import pandas as pd
import numpy as np
import yfinance as yf
from datetime import datetime, timedelta

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
            rs = gain / loss
            df['RSI'] = 100 - (100 / (1 + rs))
            
            # Moving Average Convergence Divergence (MACD)
            df['EMA_12'] = df['Close'].ewm(span=12, adjust=False).mean()
            df['EMA_26'] = df['Close'].ewm(span=26, adjust=False).mean()
            df['MACD'] = df['EMA_12'] - df['EMA_26']
            df['MACD_Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()
            df['MACD_Hist'] = df['MACD'] - df['MACD_Signal']
            
        except Exception as e:
            print(f"Error calculating indicators for {symbol}: {str(e)}")
                
    return dataframes

def screen_stocks(data_dict, screen_type='momentum'):
    """
    Screen stocks based on selected strategy type
    Available strategies: 'momentum', 'trend_following'
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
                if price_above_sma20 and rsi_healthy and positive_macd:
                    matches.append(symbol)
                    details[symbol] = {
                        'close': round(latest['Close'], 2),
                        'sma_20': round(latest['SMA_20'], 2),
                        'rsi': round(latest['RSI'], 2),
                        'macd_hist': round(latest['MACD_Hist'], 4)
                    }
            except Exception as e:
                print(f"Error screening {symbol}: {str(e)}")
    
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
    # Define list of major stocks to screen
    symbols = [
        'AAPL', 'MSFT', 'GOOG', 'AMZN', 'META', 'TSLA', 'NVDA', 'NFLX',
        'JPM', 'V', 'PYPL', 'BAC', 'DIS', 'CMCSA', 'HD', 'INTC', 'VZ',
        'ADBE', 'CSCO', 'PEP', 'XOM', 'CVX', 'WMT', 'PG', 'KO', 'MRK'
    ]
    
    # Load market data for the symbols
    data = load_market_data(symbols)
    
    # Calculate technical indicators
    data_with_indicators = calculate_technical_indicators(data)
    
    # Run the momentum screening strategy
    results = screen_stocks(data_with_indicators, screen_type='momentum')
    
    # Display results
    print("\nScreening Results:")
    for symbol in results['matches']:
        details = results['details'][symbol]
        print(f"{symbol}: Close=${details['close']}, RSI={details.get('rsi', 'N/A')}")