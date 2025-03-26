"""
Simple Working Stock Screener
- Implements basic momentum screening strategy
- Uses standard Python libraries
- Includes proper error handling
- Returns a list of stocks meeting specific criteria
"""

import pandas as pd
import numpy as np
import yfinance as yf
import json
import sys
from datetime import datetime
import warnings

# Suppress warnings to keep output clean
warnings.filterwarnings('ignore')

def get_sp500_symbols():
    """Get S&P 500 symbols"""
    try:
        # This URL contains the S&P 500 list on Wikipedia
        url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
        tables = pd.read_html(url)
        df = tables[0]
        symbols = df['Symbol'].tolist()
        # Clean symbols
        symbols = [s.replace('.', '-') for s in symbols]
        print(f"Successfully loaded {len(symbols)} S&P 500 symbols")
        return symbols
    except Exception as e:
        print(f"Error fetching S&P 500 symbols: {e}")
        return None

def get_basic_symbols():
    """Return a basic list of popular stocks"""
    # Return a list of major stocks across different sectors
    return [
        'AAPL', 'MSFT', 'GOOG', 'AMZN', 'META', 'TSLA', 'NVDA', 'NFLX',
        'JPM', 'V', 'PYPL', 'BAC', 'DIS', 'CMCSA', 'HD', 'INTC', 'VZ',
        'ADBE', 'CSCO', 'PEP', 'XOM', 'CVX', 'WMT', 'PG', 'KO', 'MRK'
    ]

def load_stock_data(symbols, period='1mo'):
    """
    Load stock data for multiple symbols
    """
    data = {}
    
    # Handle single symbol case
    if isinstance(symbols, str):
        symbols = [symbols]
    
    print(f"Loading data for {len(symbols)} symbols...")
    
    # Limit symbols to first 30 for testing purposes
    # In production, process all symbols
    symbols_to_process = symbols[:30]
    
    for symbol in symbols_to_process:
        try:
            # Download data
            stock = yf.Ticker(symbol)
            df = stock.history(period=period)
            
            # Skip if no data
            if df.empty:
                print(f"No data available for {symbol}")
                continue
                
            # Add to result dictionary
            data[symbol] = df
            print(f"Loaded {len(df)} data points for {symbol}")
        except Exception as e:
            print(f"Error loading data for {symbol}: {str(e)}")
    
    print(f"Successfully loaded data for {len(data)} symbols")
    return data

def calculate_indicators(data_dict):
    """
    Calculate technical indicators for stock screening
    """
    for symbol, df in data_dict.items():
        try:
            # Skip if dataframe is empty
            if df.empty:
                continue
                
            # Calculate moving averages
            df['SMA_20'] = df['Close'].rolling(window=20).mean()
            df['SMA_50'] = df['Close'].rolling(window=50).mean()
            
            # Calculate RSI
            delta = df['Close'].diff()
            gain = delta.where(delta > 0, 0).rolling(window=14).mean()
            loss = -delta.where(delta < 0, 0).rolling(window=14).mean()
            
            # Handle division by zero
            loss = loss.replace(0, 0.000001)
            rs = gain / loss
            df['RSI'] = 100 - (100 / (1 + rs))
            
            # MACD
            df['EMA_12'] = df['Close'].ewm(span=12, adjust=False).mean()
            df['EMA_26'] = df['Close'].ewm(span=26, adjust=False).mean()
            df['MACD'] = df['EMA_12'] - df['EMA_26']
            df['MACD_Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()
            df['MACD_Hist'] = df['MACD'] - df['MACD_Signal']
            
            # Volume indicators
            df['Volume_SMA_20'] = df['Volume'].rolling(window=20).mean()
            
        except Exception as e:
            print(f"Error calculating indicators for {symbol}: {str(e)}")
    
    return data_dict

def screen_momentum(data_dict):
    """
    Basic momentum screening strategy
    """
    matches = []
    details = {}
    
    for symbol, df in data_dict.items():
        try:
            # Need enough data for calculations
            if len(df) < 20:
                continue
                
            # Get latest values
            latest = df.iloc[-1]
            
            # Screen criteria
            price_above_sma20 = latest['Close'] > latest['SMA_20']
            rsi_healthy = 30 < latest['RSI'] < 70
            positive_macd = latest['MACD_Hist'] > 0
            volume_above_avg = latest['Volume'] > latest['Volume_SMA_20']
            
            # Stock passes if it meets all criteria
            if price_above_sma20 and rsi_healthy and positive_macd and volume_above_avg:
                matches.append(symbol)
                details[symbol] = {
                    'price': latest['Close'],
                    'sma20': latest['SMA_20'],
                    'rsi': latest['RSI'],
                    'macd_hist': latest['MACD_Hist'],
                    'volume_ratio': latest['Volume'] / latest['Volume_SMA_20']
                }
        except Exception as e:
            print(f"Error screening {symbol}: {str(e)}")
    
    return {
        'matches': matches,
        'details': details
    }

def main():
    try:
        # Get symbols for screening
        print("Getting stock symbols...")
        sp500 = get_sp500_symbols()
        
        symbols = sp500 if sp500 else get_basic_symbols()
        
        if not symbols:
            print("No symbols to process")
            sys.exit(1)
        
        # Get stock data
        print(f"Loading stock data for {len(symbols)} symbols...")
        stock_data = load_stock_data(symbols)
        
        if not stock_data:
            print("Failed to load any stock data")
            sys.exit(1)
            
        # Calculate indicators
        print("Calculating technical indicators...")
        data_with_indicators = calculate_indicators(stock_data)
        
        # Run momentum screening
        print("Running momentum screening strategy...")
        results = screen_momentum(data_with_indicators)
        
        # Output results
        matched_count = len(results['matches'])
        print(f"\nFound {matched_count} stocks meeting momentum criteria")
        
        for i, symbol in enumerate(results['matches']):
            if i < 10:  # Show first 10 matches
                details = results['details'][symbol]
                print(f"{symbol}: Price=${details['price']:.2f}, RSI={details['rsi']:.2f}, MACD Hist={details['macd_hist']:.4f}")
        
        # Return results as JSON
        print(json.dumps({
            'success': True,
            'matches': results['matches'],
            'details': {k: {kk: float(vv) if isinstance(vv, (float, int)) else vv 
                           for kk, vv in v.items()} 
                      for k, v in results['details'].items()},
            'count': matched_count,
            'timestamp': datetime.now().isoformat()
        }))
        
        return 0
        
    except Exception as e:
        error_message = f"Error in screener: {str(e)}"
        print(error_message)
        
        # Return error as JSON
        print(json.dumps({
            'success': False,
            'error': error_message,
            'matches': [],
            'details': {},
            'count': 0,
            'timestamp': datetime.now().isoformat()
        }))
        
        return 1

if __name__ == "__main__":
    sys.exit(main())