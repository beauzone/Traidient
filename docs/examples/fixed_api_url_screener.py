import os
import requests
import json
from datetime import datetime, timedelta

def screen_stocks(data_dict):
    """
    Fixed screener using correct Alpaca API endpoints
    This separates trading API from market data API
    """
    print("=" * 50)
    print("FIXED API URL SCREENER")
    print("Using correct data API endpoints")
    print("=" * 50)
    
    # Initialize results
    matches = []
    details = {}
    errors = []
    
    # Configure Alpaca API access
    API_KEY = os.environ.get('ALPACA_API_KEY')
    API_SECRET = os.environ.get('ALPACA_API_SECRET')
    
    # Verify we have API credentials
    if not API_KEY or not API_SECRET:
        print("ERROR: Alpaca API credentials not found in environment")
        result = {
            'matches': [],
            'details': {},
            'errors': ["Alpaca API credentials not found"]
        }
        print("RESULT_JSON_START")
        print(json.dumps(result))
        print("RESULT_JSON_END")
        return result
    
    print(f"Alpaca API credentials found")
    
    # IMPORTANT: Separate base URLs for trading API and data API
    TRADING_BASE_URL = "https://paper-api.alpaca.markets"
    DATA_BASE_URL = "https://data.alpaca.markets"
    
    # List of stocks to screen (major tech and blue chips)
    symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", "AMD"]
    
    # Headers for API requests
    headers = {
        'APCA-API-KEY-ID': API_KEY,
        'APCA-API-SECRET-KEY': API_SECRET,
        'Accept': 'application/json'
    }
    
    # First, test the trading API connection with account info
    try:
        print(f"Testing trading API connection")
        account_url = f"{TRADING_BASE_URL}/v2/account"
        print(f"Request URL: {account_url}")
        
        account_response = requests.get(account_url, headers=headers)
        
        print(f"Response status code: {account_response.status_code}")
        
        if account_response.status_code != 200:
            print(f"API connection test failed: {account_response.status_code}")
            print(f"Response text: {account_response.text}")
            result = {
                'matches': [],
                'details': {},
                'errors': [f"API connection failed: {account_response.text}"]
            }
            print("RESULT_JSON_START")
            print(json.dumps(result))
            print("RESULT_JSON_END")
            return result
            
        account_data = account_response.json()
        print(f"Trading API connection successful - Account ID: {account_data.get('id', 'unknown')}")
    except Exception as e:
        print(f"Trading API connection test error: {str(e)}")
        result = {
            'matches': [],
            'details': {},
            'errors': [f"Trading API connection error: {str(e)}"]
        }
        print("RESULT_JSON_START")
        print(json.dumps(result))
        print("RESULT_JSON_END")
        return result
    
    # Now use the data API to get historical price data
    print(f"Testing Data API connection")
    
    # Get historical bars for last 5 days
    end_date = datetime.now()
    start_date = end_date - timedelta(days=5)
    
    # Format dates as ISO strings
    start_str = start_date.strftime('%Y-%m-%d')
    end_str = end_date.strftime('%Y-%m-%d')
    
    print(f"Fetching bar data from {start_str} to {end_str}")
    
    # Process each symbol individually
    for symbol in symbols:
        try:
            # Correct data API endpoint for bars
            bars_url = f"{DATA_BASE_URL}/v2/stocks/{symbol}/bars"
            params = {
                'start': start_str,
                'end': end_str,
                'timeframe': '1D',
                'limit': 5
            }
            
            print(f"Requesting data for {symbol}")
            print(f"Request URL: {bars_url}")
            
            # Make the API request to the data API
            response = requests.get(bars_url, headers=headers, params=params)
            
            # Log the full response for debugging
            print(f"Response status: {response.status_code}")
            if response.status_code != 200:
                print(f"Error fetching data for {symbol}: {response.status_code}")
                print(f"Response text: {response.text}")
                errors.append(f"Error fetching data for {symbol}: {response.status_code} - {response.text}")
                continue
            
            # Parse the JSON response
            bars_data = response.json()
            
            # Print structure of response
            print(f"Response structure: {list(bars_data.keys())}")
            
            # Check if bars are present
            if 'bars' not in bars_data or not bars_data['bars']:
                print(f"No data bars returned for {symbol}")
                continue
            
            # Get the most recent bar
            latest_bar = bars_data['bars'][-1]
            current_price = latest_bar['c']
            
            print(f"{symbol} - Current price: ${current_price}")
            
            # Very simple criteria: price above $100
            if current_price > 100:
                matches.append(symbol)
                details[symbol] = {
                    "price": float(current_price),
                    "date": latest_bar['t'],
                    "volume": int(latest_bar['v']),
                    "reason": f"Price ${current_price:.2f} is above $100"
                }
                
                print(f"✓ MATCH: {symbol} - Price ${current_price:.2f} is above $100")
            else:
                print(f"× NO MATCH: {symbol} - Price ${current_price:.2f} is below $100")
                
        except Exception as e:
            print(f"Error processing {symbol}: {str(e)}")
            import traceback
            traceback.print_exc()
            errors.append(f"Error processing {symbol}: {str(e)}")
    
    # If no matches found, explain why
    if not matches:
        print("No stocks found with price above $100")
        for error in errors:
            print(f"- {error}")
    
    # Print final result count
    print(f"Found {len(matches)} matching stocks out of {len(symbols)} symbols")
    if errors:
        print(f"Encountered {len(errors)} errors during processing")
    
    # Prepare the result - NO DEFAULT VALUES
    result = {
        'matches': matches,
        'details': details,
        'errors': errors if errors else None
    }
    
    # Print with special markers for proper extraction
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    
    return result