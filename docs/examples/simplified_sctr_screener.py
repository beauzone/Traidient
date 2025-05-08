import yfinance as yf
import pandas as pd
import numpy as np
import ta

def screen_stocks(data_dict):
    """
    Modified SCTR-inspired screener that works with the platform execution system.
    """
    print(f"Starting SCTR screener with {len(data_dict)} symbols")
    
    # Configuration parameters
    params = {
        "sctr_threshold": 40,  # Lower threshold to catch more stocks
        "min_price": 5,
        "min_volume": 250000
    }
    
    # Will hold our matching symbols and details
    matches = []
    details = {}
    
    # Instead of looping through data_dict (which is empty), 
    # we'll manually fetch data for a few symbols
    tickers_to_check = list(data_dict.keys())[:7]  # Limit to avoid timeouts
    
    print(f"Checking tickers: {', '.join(tickers_to_check)}")
    
    for ticker in tickers_to_check:
        try:
            # Download data - this part actually does the work since data_dict is empty
            print(f"Downloading data for {ticker}")
            df = yf.download(ticker, period="3mo", interval="1d", progress=False)
            
            if df.empty or len(df) < 20:
                print(f"Not enough data for {ticker}")
                continue
                
            # Calculate basic technical indicators
            df["ema_50"] = ta.trend.ema_indicator(df["Close"], window=50)
            df["rsi_14"] = ta.momentum.rsi(df["Close"], window=14)
            df["volume_sma_20"] = df["Volume"].rolling(window=20).mean()
            
            # Get the latest data
            latest = df.iloc[-1]
            
            # Simple criteria for testing
            close = latest["Close"]
            rsi = latest["rsi_14"]
            volume = latest["volume_sma_20"]
            
            # Check basic criteria
            if (close > params["min_price"] and 
                volume > params["min_volume"] and 
                rsi > 45):  # RSI shows some strength
                
                # Add to results
                matches.append(ticker)
                details[ticker] = {
                    "price": float(close),
                    "rsi": float(rsi),
                    "score": float(min(rsi, 99)),
                    "details": f"Price: ${round(close, 2)}, RSI: {round(rsi, 1)}"
                }
                print(f"✓ {ticker} matched criteria")
            else:
                print(f"✗ {ticker} did not match criteria")
                
        except Exception as e:
            print(f"Error processing {ticker}: {str(e)}")
            continue
    
    print(f"SCTR screener completed. Found {len(matches)} matches.")
    
    # Return in the expected format
    return {
        'matches': matches,
        'details': details
    }