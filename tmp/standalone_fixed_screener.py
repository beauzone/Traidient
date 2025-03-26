"""
Standalone Fixed Screener

This screener is designed to:
1. Work with any stock symbol list
2. Implement reliable basic technical indicators
3. Avoid any template injection issues
4. Return properly formatted JSON results
"""

import pandas as pd
import numpy as np
import json
import sys
import os
from datetime import datetime, timedelta
import warnings
import yfinance as yf

# Suppress warnings
warnings.filterwarnings('ignore')

def get_stock_symbols():
    """Get a reliable set of stock symbols - combines multiple sources for robustness"""
    # Hardcoded major stock symbols as fallback
    major_stocks = [
        "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK-B", "JPM", "V", 
        "UNH", "JNJ", "XOM", "PG", "MA", "HD", "CVX", "MRK", "LLY", "AVGO", 
        "COST", "ABBV", "PEP", "KO", "ADBE", "MCD", "TMO", "ABT", "CSCO", "WMT"
    ]
    
    try:
        # Try to get S&P 500 symbols
        sp500 = pd.read_html("https://en.wikipedia.org/wiki/List_of_S%26P_500_companies")[0]
        sp500_symbols = sp500['Symbol'].tolist()
        
        # Combine and deduplicate
        all_symbols = list(set(major_stocks + sp500_symbols))
        print(f"Using {len(all_symbols)} symbols from combined sources")
        return all_symbols[:100]  # Limit to first 100 for testing speed
    except Exception as e:
        print(f"Error fetching comprehensive symbols: {e}")
        print(f"Falling back to {len(major_stocks)} major stocks")
        return major_stocks

def load_market_data(symbols, period='1mo', interval='1d'):
    """Load market data for multiple symbols using yfinance"""
    data = {}
    
    # Handle single symbol case
    if isinstance(symbols, str):
        symbols = [symbols]
    
    print(f"Loading data for {len(symbols)} symbols...")
    
    for symbol in symbols:
        try:
            # Download data
            stock = yf.Ticker(symbol)
            df = stock.history(period=period, interval=interval)
            
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
    """Calculate technical indicators for stock screening"""
    results = {}
    
    for symbol, df in data_dict.items():
        # Skip if not enough data
        if len(df) < 20:
            continue
            
        # Copy to avoid SettingWithCopyWarning
        result_df = df.copy()
        
        # Simple moving averages
        result_df['MA20'] = df['Close'].rolling(window=20).mean()
        result_df['MA50'] = df['Close'].rolling(window=50).mean()
        result_df['MA200'] = df['Close'].rolling(window=200).mean()
        
        # Volume moving average
        result_df['Volume_MA20'] = df['Volume'].rolling(window=20).mean()
        
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
        
        # MACD
        ema_12 = df['Close'].ewm(span=12, adjust=False).mean()
        ema_26 = df['Close'].ewm(span=26, adjust=False).mean()
        result_df['MACD'] = ema_12 - ema_26
        result_df['MACD_Signal'] = result_df['MACD'].ewm(span=9, adjust=False).mean()
        result_df['MACD_Hist'] = result_df['MACD'] - result_df['MACD_Signal']
        
        # Store results
        results[symbol] = result_df
    
    return results

def screen_momentum(data_dict):
    """Basic momentum screening strategy"""
    matches = []
    details = {}
    
    for symbol, df in data_dict.items():
        # Need enough data and indicators calculated
        if len(df) < 20 or 'RSI' not in df.columns:
            continue
        
        # Get the most recent values
        latest = df.iloc[-1]
        
        # Skip if there are missing values
        if pd.isna(latest['MA20']) or pd.isna(latest['RSI']) or pd.isna(latest['MACD_Hist']):
            continue
        
        # Screening criteria:
        # 1. Price > 20-day MA (uptrend)
        # 2. RSI between 30 and 70 (not overbought/oversold)
        # 3. MACD Histogram > 0 (bullish momentum)
        # 4. Volume > 20-day average volume (strong interest)
        
        criteria_met = (
            latest['Close'] > latest['MA20'] and
            30 < latest['RSI'] < 70 and
            latest['MACD_Hist'] > 0 and
            latest['Volume'] > latest['Volume_MA20']
        )
        
        if criteria_met:
            matches.append(symbol)
            details[symbol] = {
                "price": round(latest['Close'], 2),
                "ma20": round(latest['MA20'], 2),
                "rsi": round(latest['RSI'], 2),
                "macd_hist": round(latest['MACD_Hist'], 4),
                "volume": int(latest['Volume']),
                "volume_ma20": int(latest['Volume_MA20'])
            }
    
    return {
        "matches": matches,
        "details": details,
        "count": len(matches)
    }

def main():
    """Main function that runs the screener"""
    try:
        # Start timing
        start_time = datetime.now()
        
        # Get reliable stock symbols
        symbols = get_stock_symbols()
        
        # Load market data
        data = load_market_data(symbols, period="1mo")
        
        # Calculate indicators
        indicators = calculate_indicators(data)
        
        # Apply momentum screening
        screen_results = screen_momentum(indicators)
        
        # Calculate execution time
        end_time = datetime.now()
        execution_time = (end_time - start_time).total_seconds()
        
        # Format results
        results = {
            "success": True,
            "matches": screen_results["matches"],
            "details": screen_results["details"],
            "count": screen_results["count"],
            "execution_time": execution_time,
            "timestamp": datetime.now().isoformat()
        }
        
        # Output as JSON
        print(json.dumps(results))
        return 0
        
    except Exception as e:
        error_message = "Error in screener: " + str(e)
        print(error_message)
        
        error_result = {
            "success": False,
            "error": error_message,
            "matches": [],
            "details": {},
            "count": 0,
            "timestamp": datetime.now().isoformat()
        }
        
        print(json.dumps(error_result))
        return 1

if __name__ == "__main__":
    sys.exit(main())