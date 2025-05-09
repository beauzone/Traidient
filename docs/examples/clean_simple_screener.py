import os
import requests
import pandas as pd
import json
from datetime import datetime, timedelta

def screen_stocks(data_dict):
    """
    A clean, simple screener that returns stocks above their 50-day moving average
    No default fallbacks, only real data
    """
    print("=" * 50)
    print("CLEAN SIMPLE SCREENER")
    print("Finds stocks trading above their 50-day moving average")
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
        result = {
            'matches': [],
            'details': {"error": "Alpaca API credentials not found"}
        }
        print("RESULT_JSON_START")
        print(json.dumps(result))
        print("RESULT_JSON_END")
        return result
    
    # Alpaca API endpoints
    BASE_URL = "https://paper-api.alpaca.markets"
    
    # List of stocks to screen
    symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", "AMD", "INTC", "JPM"]
    
    # Headers for API requests
    headers = {
        'APCA-API-KEY-ID': API_KEY,
        'APCA-API-SECRET-KEY': API_SECRET,
        'Accept': 'application/json'
    }
    
    # Test API connection
    try:
        account_url = f"{BASE_URL}/v2/account"
        print(f"Testing API connection with account endpoint")
        
        account_response = requests.get(account_url, headers=headers)
        
        if account_response.status_code != 200:
            print(f"API connection test failed: {account_response.status_code}")
            result = {
                'matches': [],
                'details': {"error": f"API connection failed: {account_response.text}"}
            }
            print("RESULT_JSON_START")
            print(json.dumps(result))
            print("RESULT_JSON_END")
            return result
            
        print(f"API connection successful")
    except Exception as e:
        print(f"API connection test error: {str(e)}")
        result = {
            'matches': [],
            'details': {"error": f"API connection error: {str(e)}"}
        }
        print("RESULT_JSON_START")
        print(json.dumps(result))
        print("RESULT_JSON_END")
        return result
    
    # Get historical data for moving average calculation
    # We'll get 60 days of daily bars to calculate a 50-day moving average
    end_date = datetime.now()
    start_date = end_date - timedelta(days=60)
    
    # Format dates as ISO strings
    start_str = start_date.strftime('%Y-%m-%d')
    end_str = end_date.strftime('%Y-%m-%d')
    
    print(f"Fetching data from {start_str} to {end_str} for {len(symbols)} symbols")
    successful_calls = 0
    
    for symbol in symbols:
        try:
            # Build the URL for fetching daily bars
            bars_url = f"{BASE_URL}/v2/stocks/{symbol}/bars"
            params = {
                'start': start_str,
                'end': end_str,
                'timeframe': '1D',
                'limit': 60
            }
            
            print(f"Requesting data for {symbol}")
            
            # Make the API request
            response = requests.get(bars_url, headers=headers, params=params)
            
            if response.status_code != 200:
                print(f"Error fetching data for {symbol}: {response.status_code}")
                continue
            
            # Parse the JSON response
            bars_data = response.json()
            successful_calls += 1
            
            # Check if we have enough data
            if not bars_data.get('bars') or len(bars_data['bars']) < 50:
                print(f"Not enough data for {symbol}, skipping (need at least 50 bars)")
                continue
            
            # Convert to pandas DataFrame
            df = pd.DataFrame(bars_data['bars'])
            
            # Convert timestamp to datetime
            df['t'] = pd.to_datetime(df['t'])
            
            # Set timestamp as index
            df.set_index('t', inplace=True)
            
            # Calculate 50-day moving average
            df['sma50'] = df['c'].rolling(window=50).mean()
            
            # Get latest values
            latest = df.iloc[-1]
            
            # Calculate percent above/below moving average
            current_price = latest['c']
            moving_avg = latest['sma50']
            pct_diff = (current_price - moving_avg) / moving_avg * 100 if moving_avg else 0
            
            print(f"{symbol} - Current price: ${current_price:.2f}, 50-day SMA: ${moving_avg:.2f}")
            print(f"  Price is {pct_diff:.2f}% {'above' if pct_diff > 0 else 'below'} 50-day SMA")
            
            # Check if price is above moving average
            if current_price > moving_avg:
                matches.append(symbol)
                details[symbol] = {
                    "price": float(current_price),
                    "sma50": float(moving_avg),
                    "percent_above": float(pct_diff),
                    "volume": int(latest['v'])
                }
                
                print(f"✓ MATCH: {symbol} - Price is {pct_diff:.2f}% above 50-day SMA")
            else:
                print(f"× NO MATCH: {symbol} - Price is below 50-day SMA")
                
        except Exception as e:
            print(f"Error processing {symbol}: {str(e)}")
    
    # If no matches found, explain why but don't add any default data
    if not matches:
        print("No stocks found trading above their 50-day moving average")
    
    # Print final result count
    print(f"Found {len(matches)} matching stocks out of {successful_calls} successfully processed")
    
    # Prepare the result - NO DEFAULT VALUES HERE
    result = {
        'matches': matches,
        'details': details
    }
    
    # Print with special markers for proper extraction
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    
    return result