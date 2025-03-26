"""
Working Stock Screener
- Uses simple, reliable code structure
- Avoids syntax errors by using standard string formatting
- Works with any stock universe
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

def get_sp500_symbols():
    """Get S&P 500 symbols from Wikipedia"""
    try:
        # Get S&P 500 components from Wikipedia
        sp500 = pd.read_html("https://en.wikipedia.org/wiki/List_of_S%26P_500_companies")[0]
        return sp500['Symbol'].tolist()
    except Exception as e:
        print("Error fetching S&P 500 symbols: {}".format(str(e)))
        return []

def get_basic_symbols():
    """Return a basic list of popular stocks"""
    return ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM", "V", "PG", 
            "JNJ", "UNH", "HD", "XOM", "CVX", "BAC", "PFE", "CSCO", "ADBE", "CRM", 
            "NFLX", "DIS", "INTC", "VZ", "KO", "PEP", "WMT", "ABT", "MRK", "CMCSA", 
            "NKE", "TMO", "COST", "AVGO", "ACN", "DHR", "MCD", "ABBV", "TXN", "QCOM"]

def load_stock_data(symbols, period="1mo"):
    """
    Load stock data for multiple symbols
    """
    data = {}
    
    # Handle single symbol case
    if isinstance(symbols, str):
        symbols = [symbols]
    
    print("Loading data for {} symbols...".format(len(symbols)))
    
    for symbol in symbols:
        try:
            # Download data
            stock = yf.Ticker(symbol)
            df = stock.history(period=period)
            
            # Skip if no data
            if df.empty:
                print("No data available for {}".format(symbol))
                continue
                
            # Add to result dictionary
            data[symbol] = df
            print("Loaded {} data points for {}".format(len(df), symbol))
        except Exception as e:
            print("Error loading data for {}: {}".format(symbol, str(e)))
    
    print("Successfully loaded data for {} symbols".format(len(data)))
    return data

def calculate_indicators(data_dict):
    """
    Calculate technical indicators for stock screening
    """
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
    """
    Basic momentum screening strategy
    """
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
    try:
        # Get universe of symbols - combine S&P 500 with popular stocks
        sp500 = get_sp500_symbols()
        popular = get_basic_symbols()
        symbols = list(set(sp500 + popular))
        
        # Limit to first 100 symbols for testing - remove this in production
        symbols = symbols[:100]
        
        print("Using {} symbols for screening".format(len(symbols)))
        
        # Load market data
        data = load_stock_data(symbols, period="1mo")
        
        # Calculate technical indicators
        indicators = calculate_indicators(data)
        
        # Apply momentum screening strategy
        screen_results = screen_momentum(indicators)
        
        # Add timestamp for the run
        results = {
            "success": True,
            "matches": screen_results["matches"],
            "details": screen_results["details"],
            "count": screen_results["count"],
            "timestamp": datetime.now().isoformat()
        }
        
        # Output as JSON
        print(json.dumps(results))
        return 0
        
    except Exception as e:
        error_message = "Error in screener: {}".format(str(e))
        print(json.dumps({
            "success": False,
            "error": error_message,
            "matches": [],
            "details": {},
            "count": 0,
            "timestamp": datetime.now().isoformat()
        }))
        return 1

if __name__ == "__main__":
    sys.exit(main())