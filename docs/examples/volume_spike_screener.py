import os
import requests
import pandas as pd
import numpy as np
import json
from datetime import datetime, timedelta
import time

def screen_stocks(data_dict):
    """
    A self-contained screener that identifies unusual volume spikes
    This screener fetches its own data from Alpaca API
    """
    print("=" * 50)
    print("Starting Volume Spike Screener")
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
    
    # First try to get the top stocks by volume from Alpaca
    print("Fetching asset universe from Alpaca...")
    
    # Using a basic set of tickers for demonstration
    tickers = [
        "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "NVDA", "AMD", 
        "INTC", "PYPL", "ADBE", "CRM", "NFLX", "DIS", "BA", "MRNA", "GME",
        "AMC", "PLTR", "RIVN", "RBLX", "SNAP", "UBER", "COIN", "UPST",
        "PLUG", "PTON", "ZM", "DKNG", "NIO"
    ]
    
    # Try to get more active stocks from Alpaca assets API
    try:
        assets_endpoint = f"{BASE_URL}/v2/assets"
        assets_params = {
            'status': 'active',
            'asset_class': 'us_equity',
            'exchange': 'NASDAQ'
        }
        
        assets_response = requests.get(assets_endpoint, headers=headers, params=assets_params)
        
        if assets_response.status_code == 200:
            assets_data = assets_response.json()
            # Add some of these assets to our universe
            added_count = 0
            for asset in assets_data:
                if asset['tradable'] and asset['symbol'] not in tickers:
                    tickers.append(asset['symbol'])
                    added_count += 1
                    if added_count >= 20:  # Add up to 20 more stocks
                        break
            print(f"Added {added_count} more stocks from Alpaca assets")
        else:
            print(f"Could not fetch assets list: {assets_response.status_code}")
    except Exception as e:
        print(f"Error fetching assets: {str(e)}")
    
    print(f"Screening {len(tickers)} stocks for volume spikes...")
    
    # Calculate date ranges for historical data (last 15 trading days)
    end_date = datetime.now()
    start_date = (end_date - timedelta(days=30)).strftime("%Y-%m-%d")
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
            
            if len(df) < 10:
                print(f"Not enough data for {ticker}, skipping")
                continue
                
            print(f"Got {len(df)} days of data for {ticker}")
            
            # Get current price and volume
            current_price = df['c'].iloc[-1]
            current_volume = df['v'].iloc[-1]
            
            # Calculate volume metrics
            # 10-day average volume
            df['vol_sma_10'] = df['v'].rolling(window=10).mean()
            avg_volume_10d = df['vol_sma_10'].iloc[-1]
            
            # Today's volume relative to 10-day average
            volume_ratio = current_volume / avg_volume_10d if avg_volume_10d > 0 else 0
            
            # Price change percentage
            daily_return = (df['c'].iloc[-1] / df['c'].iloc[-2] - 1) * 100 if len(df) > 1 else 0
            
            # Check for volume spike (volume > 2x 10-day average)
            is_volume_spike = volume_ratio > 2.0
            
            # Price trend (positive or negative)
            price_direction = "up" if daily_return > 0 else "down"
            
            # Print results
            print(f"  Current price: ${current_price:.2f}")
            print(f"  Today's volume: {current_volume:,.0f}")
            print(f"  10-day avg volume: {avg_volume_10d:,.0f}")
            print(f"  Volume ratio: {volume_ratio:.2f}x")
            print(f"  Daily price change: {daily_return:.2f}%")
            
            # Determine if this stock matches our criteria
            if is_volume_spike:
                matches.append(ticker)
                details[ticker] = {
                    "price": float(current_price),
                    "volume": float(current_volume),
                    "avg_volume": float(avg_volume_10d),
                    "volume_ratio": float(volume_ratio),
                    "price_change": float(daily_return),
                    "price_direction": price_direction,
                    "details": f"Volume spike of {volume_ratio:.2f}x with {daily_return:.2f}% price change"
                }
                print(f"✅ {ticker} added as a match: {volume_ratio:.2f}x volume spike")
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