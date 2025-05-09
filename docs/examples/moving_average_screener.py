import os
import requests
import pandas as pd
import numpy as np
import json
from datetime import datetime, timedelta

def screen_stocks(data_dict):
    """
    A simple moving average screener that looks for stocks 
    trading above their 20-day moving average
    """
    print("=" * 50)
    print("MOVING AVERAGE SCREENER")
    print("This screener finds stocks trading above their 20-day moving average")
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
    
    # List of stocks to screen (common large cap stocks)
    symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", "AMD", "INTC", "JPM", "BAC", "WFC", "V", "MA"]
    
    # Headers for API requests
    headers = {
        'APCA-API-KEY-ID': API_KEY,
        'APCA-API-SECRET-KEY': API_SECRET,
        'Accept': 'application/json'
    }
    
    # Test API connection first
    try:
        account_url = f"{BASE_URL}/v2/account"
        account_response = requests.get(account_url, headers=headers)
        
        if account_response.status_code != 200:
            print(f"API connection test failed with status code: {account_response.status_code}")
            print(f"Response: {account_response.text}")
            print("RESULT_JSON_START")
            print(json.dumps({
                'matches': [],
                'details': {"error": "API connection failed"}
            }))
            print("RESULT_JSON_END")
            return {'matches': [], 'details': {"error": "API connection failed"}}
            
        print("✅ API connection successful!")
    except Exception as e:
        print(f"API connection test exception: {str(e)}")
        print("RESULT_JSON_START")
        print(json.dumps({
            'matches': [],
            'details': {"error": f"API connection error: {str(e)}"}
        }))
        print("RESULT_JSON_END")
        return {'matches': [], 'details': {"error": f"API connection error: {str(e)}"}}
    
    # Get historical data for moving average calculation
    # We'll get 30 days of daily bars to calculate a 20-day moving average
    end_date = datetime.now()
    start_date = end_date - timedelta(days=40)  # Get extra days for calculation
    
    # Format dates as ISO strings
    start_str = start_date.strftime('%Y-%m-%d')
    end_str = end_date.strftime('%Y-%m-%d')
    
    print(f"Fetching data from {start_str} to {end_str} for {len(symbols)} symbols")
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
            
            print(f"Requesting data for {symbol}")
            
            # Make the API request
            response = requests.get(bars_url, headers=headers, params=params)
            
            if response.status_code != 200:
                print(f"Error fetching data for {symbol}: {response.status_code} - {response.text}")
                api_errors += 1
                continue
            
            # Parse the JSON response
            bars_data = response.json()
            successful_calls += 1
            
            # Log the number of bars received
            num_bars = len(bars_data.get('bars', []))
            print(f"Received {num_bars} bars for {symbol}")
            
            # Check if we have enough data
            if not bars_data.get('bars') or len(bars_data['bars']) < 20:
                print(f"Not enough data for {symbol}, skipping (need at least 20 bars)")
                continue
            
            # Convert to pandas DataFrame
            df = pd.DataFrame(bars_data['bars'])
            
            # Convert timestamp to datetime
            df['t'] = pd.to_datetime(df['t'])
            
            # Set timestamp as index
            df.set_index('t', inplace=True)
            
            # Calculate 20-day moving average
            df['sma20'] = df['c'].rolling(window=20).mean()
            
            # Get latest values
            latest = df.iloc[-1]
            
            # We're looking for stocks currently trading above their 20-day SMA
            price = latest['c']
            moving_avg = latest['sma20']
            
            # Calculate percentage above/below moving average
            pct_diff = (price - moving_avg) / moving_avg * 100
            
            print(f"{symbol} - Current price: ${price:.2f}, 20-day SMA: ${moving_avg:.2f}")
            print(f"  Price is {pct_diff:.2f}% {'above' if pct_diff > 0 else 'below'} 20-day SMA")
            
            # Symbol matches if price is above the moving average
            if price > moving_avg:
                matches.append(symbol)
                details[symbol] = {
                    "price": float(price),
                    "sma20": float(moving_avg),
                    "percent_above_sma": float(pct_diff),
                    "bars_analyzed": int(len(df))
                }
                
                print(f"✅ MATCH: {symbol} - Price is {pct_diff:.2f}% above 20-day SMA")
            else:
                print(f"❌ NO MATCH: {symbol} - Price is below 20-day SMA")
                
        except Exception as e:
            print(f"Error processing {symbol}: {str(e)}")
            import traceback
            traceback.print_exc()
    
    print(f"API statistics: {successful_calls} successful calls, {api_errors} errors")
    
    # If no matches found, explain why
    if not matches:
        print("No stocks trading above their 20-day moving average were found")
    
    # Print final result count
    print(f"Found {len(matches)} stocks trading above their 20-day moving average")
    
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