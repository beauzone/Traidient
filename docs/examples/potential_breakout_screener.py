import os
import pandas as pd
import numpy as np
import json
import requests
from datetime import datetime, timedelta

def screen_stocks(data_dict):
    """
    A more sophisticated screener that identifies potential stock breakouts
    using price, volume and Bollinger Bands
    """
    print("=" * 50)
    print("Starting Potential Breakout Screener")
    print("=" * 50)
    
    # Initialize results
    matches = []
    details = {}
    
    # Configure Alpaca API access
    API_KEY = os.environ.get('ALPACA_API_KEY')
    API_SECRET = os.environ.get('ALPACA_API_SECRET')
    
    # Verify we have API credentials
    if not API_KEY or not API_SECRET:
        print("ERROR: Alpaca API credentials not found in environment")
        print("RESULT_JSON_START")
        print(json.dumps({
            'matches': [],
            'details': {"error": "Alpaca API credentials not found"}
        }))
        print("RESULT_JSON_END")
        return {'matches': [], 'details': {"error": "Alpaca API credentials not found"}}
    
    print(f"API credentials validated successfully")
    
    # Alpaca API endpoints
    BASE_URL = "https://paper-api.alpaca.markets"
    
    # First test API connection
    try:
        account_url = f"{BASE_URL}/v2/account"
        headers = {
            'APCA-API-KEY-ID': API_KEY,
            'APCA-API-SECRET-KEY': API_SECRET,
            'Accept': 'application/json'
        }
        
        account_response = requests.get(account_url, headers=headers)
        
        if account_response.status_code != 200:
            print(f"API connection test failed: {account_response.status_code}")
            print("RESULT_JSON_START")
            print(json.dumps({
                'matches': [],
                'details': {"error": f"API connection failed: {account_response.text}"}
            }))
            print("RESULT_JSON_END")
            return {'matches': [], 'details': {"error": f"API connection failed"}}
        
        print("API connection successful")
    except Exception as e:
        print(f"API connection test error: {str(e)}")
        print("RESULT_JSON_START")
        print(json.dumps({
            'matches': [],
            'details': {"error": f"API connection error: {str(e)}"}
        }))
        print("RESULT_JSON_END")
        return {'matches': [], 'details': {"error": f"API connection error: {str(e)}"}}
    
    # List of stocks to screen (tech, finance, consumer, etc.)
    symbols = [
        "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", "AMD", "INTC", "JPM", 
        "BAC", "WFC", "GS", "MS", "C", "V", "MA", "PYPL", "SQ", "WMT", "TGT", "COST",
        "HD", "LOW", "NKE", "SBUX", "MCD", "PEP", "KO", "PG", "JNJ", "UNH", "PFE", "MRK",
        "CVX", "XOM", "COP", "EOG", "NEE", "DUK", "SO", "D"
    ]
    
    # Market data endpoint with parameters
    end_date = datetime.now()
    start_date = end_date - timedelta(days=40)  # Need more data for Bollinger Bands
    
    # Format dates as ISO strings
    start_str = start_date.strftime('%Y-%m-%d')
    end_str = end_date.strftime('%Y-%m-%d')
    
    # Headers for API requests
    headers = {
        'APCA-API-KEY-ID': API_KEY,
        'APCA-API-SECRET-KEY': API_SECRET,
        'Accept': 'application/json'
    }
    
    print(f"Fetching data from {start_str} to {end_str} for {len(symbols)} symbols")
    
    # Keep track of API call statistics
    successful_calls = 0
    api_errors = 0
    
    for symbol in symbols:
        try:
            # Build the URL for fetching daily bars
            bars_url = f"{BASE_URL}/v2/stocks/{symbol}/bars"
            params = {
                'start': start_str,
                'end': end_str,
                'timeframe': '1D',
                'limit': 40
            }
            
            # Make the API request
            response = requests.get(bars_url, headers=headers, params=params)
            
            if response.status_code != 200:
                print(f"Error fetching data for {symbol}: {response.status_code}")
                api_errors += 1
                continue
            
            # Parse the JSON response
            bars_data = response.json()
            successful_calls += 1
            
            # Check if we have enough data (need at least 20 bars for Bollinger Bands)
            if not bars_data.get('bars') or len(bars_data['bars']) < 20:
                print(f"Not enough data for {symbol}, skipping")
                continue
            
            # Convert to pandas DataFrame
            df = pd.DataFrame(bars_data['bars'])
            
            # Convert timestamp to datetime
            df['t'] = pd.to_datetime(df['t'])
            
            # Set timestamp as index
            df.set_index('t', inplace=True)
            
            # Calculate 20-day moving average
            df['sma20'] = df['c'].rolling(window=20).mean()
            
            # Calculate 20-day standard deviation
            df['std20'] = df['c'].rolling(window=20).std()
            
            # Calculate Bollinger Bands
            df['upper_band'] = df['sma20'] + (df['std20'] * 2)
            df['lower_band'] = df['sma20'] - (df['std20'] * 2)
            
            # Calculate volume averages
            df['vol_sma20'] = df['v'].rolling(window=20).mean()
            
            # Calculate % distance from upper band
            df['upper_band_pct'] = (df['upper_band'] - df['c']) / df['c'] * 100
            
            # Get the most recent data point
            if len(df) < 2:
                print(f"Not enough data points for {symbol} after calculations")
                continue
                
            latest = df.iloc[-1]
            previous = df.iloc[-2]
            
            # Define potential breakout conditions:
            # 1. Close is within 3% of upper Bollinger Band
            # 2. Volume is above 20-day average
            # 3. Price is above 20-day SMA
            
            close_near_upper_band = latest['upper_band_pct'] < 3.0
            volume_above_average = latest['v'] > latest['vol_sma20'] * 1.5
            price_above_sma = latest['c'] > latest['sma20']
            
            # Compile reasons for match
            match_reasons = []
            
            if close_near_upper_band:
                match_reasons.append(f"Price is within {latest['upper_band_pct']:.2f}% of upper Bollinger Band")
            
            if volume_above_average:
                volume_ratio = latest['v'] / latest['vol_sma20']
                match_reasons.append(f"Volume is {volume_ratio:.2f}x above 20-day average")
            
            if price_above_sma:
                sma_pct = (latest['c'] - latest['sma20']) / latest['sma20'] * 100
                match_reasons.append(f"Price is {sma_pct:.2f}% above 20-day moving average")
            
            # If a stock meets our criteria, add it to the results
            is_match = False
            
            # Different combination of criteria for a match
            if close_near_upper_band and volume_above_average and price_above_sma:
                is_match = True
            elif close_near_upper_band and price_above_sma and latest['c'] > previous['c']:
                match_reasons.append("Price is rising")
                is_match = True
            
            if is_match:
                matches.append(symbol)
                details[symbol] = {
                    "price": float(latest['c']),
                    "upper_band": float(latest['upper_band']),
                    "lower_band": float(latest['lower_band']),
                    "sma20": float(latest['sma20']),
                    "volume": int(latest['v']),
                    "avg_volume": float(latest['vol_sma20']),
                    "reasons": match_reasons
                }
                
                print(f"MATCH: {symbol} - {', '.join(match_reasons)}")
        
        except Exception as e:
            print(f"Error processing {symbol}: {str(e)}")
    
    print(f"API statistics: {successful_calls} successful calls, {api_errors} errors")
    
    # If no matches found, explain why
    if not matches:
        print("No stocks matched the potential breakout criteria")
    
    # Print final result count
    print(f"Found {len(matches)} potential breakout stocks")
    
    # Prepare the result
    result = {
        'matches': matches,
        'details': details
    }
    
    # Print with special markers for proper extraction
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    
    return result