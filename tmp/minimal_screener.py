import pandas as pd
import numpy as np
import yfinance as yf
from datetime import datetime

def load_market_data(symbols, period='1mo', interval='1d'):
    """Load market data for multiple symbols using yfinance"""
    print(f"Loading data for {len(symbols)} symbols...")
    
    data = {}
    for symbol in symbols:
        try:
            ticker = yf.Ticker(symbol)
            history = ticker.history(period=period, interval=interval)
            if not history.empty:
                data[symbol] = history
                print(f"Successfully loaded data for {symbol} with {len(history)} bars")
            else:
                print(f"No data available for {symbol}")
        except Exception as e:
            print(f"Error loading data for {symbol}: {e}")
    
    return data

def calculate_technical_indicators(dataframes):
    """Calculate simple technical indicators"""
    results = {}
    
    for symbol, df in dataframes.items():
        if df.empty:
            continue
            
        result_df = df.copy()
        
        # Simple moving averages
        result_df['SMA_20'] = df['Close'].rolling(window=20).mean()
        result_df['SMA_50'] = df['Close'].rolling(window=50).mean()
        
        # RSI calculation
        delta = df['Close'].diff()
        gain = delta.where(delta > 0, 0)
        loss = -delta.where(delta < 0, 0)
        avg_gain = gain.rolling(window=14).mean()
        avg_loss = loss.rolling(window=14).mean()
        
        # Handle division by zero
        avg_loss = avg_loss.replace(0, 0.00001)
        rs = avg_gain / avg_loss
        result_df['RSI'] = 100 - (100 / (1 + rs))
        
        # Store results
        results[symbol] = result_df
        
    return results

def screen_stocks(data_dict):
    """Simple screen: price above SMA20, RSI between 30-70"""
    results = {}
    matches = []
    details = {}
    
    print(f"Running screen on {len(data_dict)} stocks")
    for symbol, df in data_dict.items():
        if df.empty or len(df) < 30:  # Need enough data for indicators
            continue
            
        try:
            # Get most recent data point
            latest = df.iloc[-1]
            
            # Screen criteria
            price_above_sma = latest['Close'] > latest['SMA_20']
            healthy_rsi = 30 < latest['RSI'] < 70
            
            # All criteria must be met
            if price_above_sma and healthy_rsi:
                matches.append(symbol)
                details[symbol] = {
                    'close': round(latest['Close'], 2),
                    'sma_20': round(latest['SMA_20'], 2),
                    'rsi': round(latest['RSI'], 2)
                }
        except Exception as e:
            print(f"Error screening {symbol}: {e}")
    
    print(f"Found {len(matches)} matches out of {len(data_dict)} stocks")
    
    return {
        'matches': matches,
        'details': details
    }

if __name__ == "__main__":
    print(f"Running test at {datetime.now()}")
    
    # Test with a small list of popular stocks
    test_symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "JPM", "V", "JNJ", "PG"]
    print(f"Testing with {len(test_symbols)} symbols: {test_symbols}")
    
    # Load market data
    data_dict = load_market_data(test_symbols)
    
    # Calculate technical indicators
    data_with_indicators = calculate_technical_indicators(data_dict)
    
    # Run the screen
    screen_results = screen_stocks(data_with_indicators)
    
    # Print results
    print("\nResults:")
    print(f"Matches ({len(screen_results['matches'])}):")
    for symbol in screen_results['matches']:
        details = screen_results['details'][symbol]
        print(f"{symbol}: Price ${details['close']} > SMA20 ${details['sma_20']}, RSI {details['rsi']}")