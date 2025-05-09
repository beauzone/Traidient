import pandas as pd
import numpy as np
import os
import json
import yfinance as yf

def screen_stocks(data_dict):
    """
    A simple screener that identifies stocks with high volume relative to their average
    This screener uses yfinance to get data rather than Alpaca
    """
    print("=" * 50)
    print("SIMPLE VOLUME SCREENER")
    print("Finds stocks with volume > 1.5x their 20-day average")
    print("=" * 50)
    
    # Initialize results
    matches = []
    details = {}
    
    # List of stocks to screen
    symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", "AMD", "JPM", "DIS", "KO", "PEP", "JNJ"]
    print(f"Screening {len(symbols)} symbols using Yahoo Finance data")
    
    for symbol in symbols:
        try:
            print(f"Fetching data for {symbol}...")
            
            # Get data from Yahoo Finance (last 30 days)
            stock = yf.Ticker(symbol)
            df = stock.history(period="30d")
            
            if df.empty or len(df) < 5:
                print(f"Not enough data for {symbol}, skipping")
                continue
                
            # Calculate 20-day average volume (or as many days as we have)
            avg_days = min(20, len(df) - 1)
            df['avg_volume'] = df['Volume'].rolling(window=avg_days).mean()
            
            # Get the latest values
            latest = df.iloc[-1]
            
            # Calculate volume ratio
            current_volume = latest['Volume']
            avg_volume = latest['avg_volume']
            volume_ratio = current_volume / avg_volume if avg_volume > 0 else 0
            
            print(f"{symbol} - Current volume: {current_volume:.0f}, Avg volume: {avg_volume:.0f}")
            print(f"  Volume ratio: {volume_ratio:.2f}x")
            
            # Check if volume is significantly above average
            if volume_ratio > 1.5:
                matches.append(symbol)
                details[symbol] = {
                    "price": float(latest['Close']),
                    "volume": float(current_volume),
                    "avg_volume": float(avg_volume),
                    "volume_ratio": float(volume_ratio),
                    "percent_change": float(latest['Close'] / df.iloc[-2]['Close'] - 1) * 100 if len(df) > 1 else 0
                }
                print(f"✅ MATCH: {symbol} - Volume is {volume_ratio:.2f}x average")
            else:
                print(f"No match: {symbol} - Volume ratio {volume_ratio:.2f}x below threshold")
                
        except Exception as e:
            print(f"Error processing {symbol}: {str(e)}")
    
    # Explain result
    if not matches:
        print("No stocks found with volume > 1.5x their 20-day average")
    else:
        print(f"Found {len(matches)} stocks with high volume")
    
    # Prepare result
    result = {
        "matches": matches,
        "details": details
    }
    
    # Output with special markers for extraction
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    
    return result