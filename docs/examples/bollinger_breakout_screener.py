import os
import requests
import pandas as pd
import numpy as np
import json
from datetime import datetime, timedelta
import time

def screen_stocks(data_dict):
    """
    A self-contained screener that identifies stocks breaking out of Bollinger Bands
    This screener fetches its own data from Alpaca API
    """
    print("=" * 50)
    print("Starting Bollinger Bands Breakout Screener")
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
    
    # Use a list of popular technology and growth stocks
    tickers = [
        "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "NVDA", 
        "AMD", "INTC", "NFLX", "PYPL", "SQ", "TWLO", "ZM", "SHOP", 
        "ADBE", "CRM", "NOW", "UBER", "ABNB", "CRWD", "SNOW", "NET"
    ]
    
    print(f"Screening {len(tickers)} stocks...")
    
    # Calculate date ranges for historical data (last 30 trading days)
    end_date = datetime.now()
    start_date = (end_date - timedelta(days=45)).strftime("%Y-%m-%d")
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
            
            # Calculate Bollinger Bands (20 periods, 2 standard deviations)
            period = 20
            std_dev = 2
            
            # Calculate 20-day SMA (middle band)
            df['sma'] = df['c'].rolling(window=period).mean()
            
            # Calculate standard deviation
            df['std'] = df['c'].rolling(window=period).std()
            
            # Calculate upper and lower bands
            df['upper_band'] = df['sma'] + (df['std'] * std_dev)
            df['lower_band'] = df['sma'] - (df['std'] * std_dev)
            
            # Calculate Bandwidth and %B indicator
            df['bandwidth'] = (df['upper_band'] - df['lower_band']) / df['sma']
            df['percent_b'] = (df['c'] - df['lower_band']) / (df['upper_band'] - df['lower_band'])
            
            # Get current price
            current_price = df['c'].iloc[-1]
            
            # Calculate average volume over last 10 days for volatility check
            df['volume_sma_10'] = df['v'].rolling(window=10).mean()
            
            # Check for Bollinger Band signals:
            # 1. Upper Breakout: Price closes above upper band (percent_b > 1)
            # 2. Lower Breakout: Price closes below lower band (percent_b < 0)
            # 3. Squeeze: Bandwidth is contracting (potential for upcoming volatility)
            
            last_percent_b = df['percent_b'].iloc[-1]
            
            # Check if bandwidth is contracting (current bandwidth < average of last 10 days)
            bandwidth_avg = df['bandwidth'].rolling(window=10).mean().iloc[-1]
            last_bandwidth = df['bandwidth'].iloc[-1]
            is_squeeze = last_bandwidth < bandwidth_avg
            
            # Check for increased volume (current volume > 1.5x 10-day average)
            last_volume = df['v'].iloc[-1]
            avg_volume = df['volume_sma_10'].iloc[-1]
            volume_increasing = last_volume > (1.5 * avg_volume)
            
            # Determine if this is an upper or lower breakout
            is_upper_breakout = last_percent_b > 1
            is_lower_breakout = last_percent_b < 0
            
            # Criteria for different signals
            is_bull_breakout = is_upper_breakout and volume_increasing
            is_bear_breakout = is_lower_breakout and volume_increasing
            is_volatility_squeeze = is_squeeze and (0.3 < last_percent_b < 0.7)
            
            # Print results
            print(f"  Current price: ${current_price:.2f}")
            print(f"  %B value: {last_percent_b:.3f}")
            print(f"  Bandwidth: {last_bandwidth:.3f} (10-day avg: {bandwidth_avg:.3f})")
            print(f"  Volume: {last_volume:.0f} (10-day avg: {avg_volume:.0f})")
            print(f"  Squeeze forming: {is_squeeze}")
            
            # Determine match type and add to results
            match_type = None
            match_details = ""
            
            if is_bull_breakout:
                match_type = "Bull Breakout"
                match_details = f"Price broke above upper Bollinger Band with increased volume. %B: {last_percent_b:.2f}"
            elif is_bear_breakout:
                match_type = "Bear Breakout"
                match_details = f"Price broke below lower Bollinger Band with increased volume. %B: {last_percent_b:.2f}"
            elif is_volatility_squeeze:
                match_type = "Volatility Squeeze"
                match_details = f"Bollinger Bands contracting, potential breakout incoming. Bandwidth: {last_bandwidth:.3f}"
            
            # If we have a match, add to results
            if match_type:
                matches.append(ticker)
                details[ticker] = {
                    "price": float(current_price),
                    "percent_b": float(last_percent_b),
                    "bandwidth": float(last_bandwidth),
                    "signal_type": match_type,
                    "details": match_details
                }
                print(f"✅ {ticker} added as a match: {match_type}")
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