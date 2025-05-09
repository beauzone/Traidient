import os
import requests
import pandas as pd
import numpy as np
import json
from datetime import datetime, timedelta
import time

def screen_stocks(data_dict):
    """
    A self-contained screener that looks for RSI < 30 (oversold) with MACD bullish crossover
    This screener fetches its own data from Alpaca API
    """
    print("=" * 50)
    print("Starting RSI + MACD Crossover Screener")
    print("=" * 50)
    
    # Initialize the results
    matches = []
    details = {}
    
    # Configure Alpaca API access
    API_KEY = os.environ.get('ALPACA_API_KEY')
    API_SECRET = os.environ.get('ALPACA_API_SECRET')
    
    # Verify we have API credentials
    if not API_KEY or not API_SECRET:
        print("ERROR: Alpaca API credentials not found in environment")
        return {'matches': [], 'details': {}}
    
    print("Alpaca API credentials found, proceeding...")
    
    # Alpaca API endpoints
    BASE_URL = "https://paper-api.alpaca.markets"
    DATA_URL = "https://data.alpaca.markets"
    
    # Headers for API requests
    headers = {
        'APCA-API-KEY-ID': API_KEY,
        'APCA-API-SECRET-KEY': API_SECRET,
        'Accept': 'application/json'
    }
    
    # Use a condensed list of stocks for screening (S&P 100 companies)
    # In a real implementation, you might use a larger universe
    tickers = [
        "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "NVDA", "JPM", 
        "V", "PG", "UNH", "HD", "MA", "BAC", "DIS", "ADBE", "CRM", "CSCO", 
        "CMCSA", "NFLX", "PFE", "KO", "PEP", "INTC", "VZ", "ABT", "MRK"
    ]
    
    print(f"Screening {len(tickers)} stocks...")
    
    # Calculate date ranges for historical data (last 30 trading days)
    end_date = datetime.now()
    start_date = (end_date - timedelta(days=60)).strftime("%Y-%m-%d")
    end_date = end_date.strftime("%Y-%m-%d")
    
    print(f"Fetching data from {start_date} to {end_date}")
    
    # Create a tracker for rate limiting
    request_count = 0
    
    # Process each ticker
    for ticker in tickers:
        try:
            # Basic rate limiting (5 requests per second max for Alpaca)
            request_count += 1
            if request_count % 5 == 0:
                print("Rate limit pause (200ms)...")
                time.sleep(0.2)
            
            print(f"Processing {ticker}...")
            
            # Get daily bar data
            bars_endpoint = f"{DATA_URL}/v2/stocks/{ticker}/bars"
            bars_params = {
                'timeframe': '1Day',
                'start': start_date,
                'end': end_date,
                'adjustment': 'raw'
            }
            
            bars_response = requests.get(bars_endpoint, headers=headers, params=bars_params)
            
            if bars_response.status_code != 200:
                print(f"Error getting bars for {ticker}: {bars_response.status_code} - {bars_response.text}")
                continue
            
            bars_data = bars_response.json()
            if 'bars' not in bars_data or not bars_data['bars']:
                print(f"No bars data for {ticker}")
                continue
            
            # Convert to pandas DataFrame
            df = pd.DataFrame(bars_data['bars'])
            df['t'] = pd.to_datetime(df['t'])
            df = df.set_index('t')
            
            print(f"Got {len(df)} days of data for {ticker}")
            
            # Create a lightweight technical analysis setup
            # Calculate RSI (14 period)
            delta = df['c'].diff()
            gain = delta.where(delta > 0, 0)
            loss = -delta.where(delta < 0, 0)
            
            avg_gain = gain.rolling(window=14).mean()
            avg_loss = loss.rolling(window=14).mean()
            
            rs = avg_gain / avg_loss
            df['rsi_14'] = 100 - (100 / (1 + rs))
            
            # Calculate MACD (12, 26, 9)
            df['ema_12'] = df['c'].ewm(span=12, adjust=False).mean()
            df['ema_26'] = df['c'].ewm(span=26, adjust=False).mean()
            df['macd'] = df['ema_12'] - df['ema_26']
            df['signal'] = df['macd'].ewm(span=9, adjust=False).mean()
            df['macd_histogram'] = df['macd'] - df['signal']
            
            # Get current price
            current_price = df['c'].iloc[-1]
            
            # Check for bullish signals
            # 1. RSI < 30 (oversold)
            # 2. MACD line crossed above Signal line recently (bullish crossover)
            
            last_rsi = df['rsi_14'].iloc[-1]
            
            # Check for MACD crossover within the last 3 days
            is_bullish_crossover = False
            for i in range(1, min(4, len(df))):
                if df['macd_histogram'].iloc[-i] > 0 and df['macd_histogram'].iloc[-i-1] <= 0:
                    is_bullish_crossover = True
                    break
            
            # Determine if this stock matches our criteria
            is_match = last_rsi < 30 and is_bullish_crossover
            
            # For stocks with low RSI but no crossover yet, include them as "almost" matches
            is_almost_match = last_rsi < 30 and not is_bullish_crossover
            
            # Print results
            print(f"  Current price: ${current_price:.2f}")
            print(f"  RSI(14): {last_rsi:.2f}")
            print(f"  MACD crossover detected: {is_bullish_crossover}")
            
            # If a match or almost match, add to results
            if is_match:
                matches.append(ticker)
                details[ticker] = {
                    "price": float(current_price),
                    "rsi": float(last_rsi),
                    "macd_crossover": True,
                    "signal_strength": "Strong Buy",
                    "details": f"RSI: {last_rsi:.2f} (oversold) with recent MACD bullish crossover"
                }
                print(f"✅ {ticker} added as a match")
            elif is_almost_match:
                matches.append(ticker)
                details[ticker] = {
                    "price": float(current_price),
                    "rsi": float(last_rsi),
                    "macd_crossover": False,
                    "signal_strength": "Potential Buy",
                    "details": f"RSI: {last_rsi:.2f} (oversold) but no MACD crossover yet"
                }
                print(f"⚠️ {ticker} added as a potential match (oversold but waiting for crossover)")
            else:
                print(f"❌ {ticker} does not match criteria")
            
        except Exception as e:
            print(f"Error processing {ticker}: {str(e)}")
            continue
    
    # Final summary
    print(f"\nScreening completed with {len(matches)} matches")
    if matches:
        print(f"Matches: {', '.join(matches)}")
    
    print("=" * 50)
    
    # Return the results
    return {
        'matches': matches,
        'details': details
    }