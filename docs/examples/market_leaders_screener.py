import os
import requests
import json
from datetime import datetime

def screen_stocks(data_dict):
    """
    Market Leaders Screener - finds top tech stocks with good volume
    Uses a simpler approach with more detailed logs to diagnose issues
    """
    print("=" * 50)
    print("MARKET LEADERS SCREENER")
    print("Finds major tech stocks with good trading volume")
    print("=" * 50)
    
    # Initialize results
    matches = []
    details = {}
    errors = []
    
    # Configure Alpaca API access
    API_KEY = os.environ.get('ALPACA_API_KEY')
    API_SECRET = os.environ.get('ALPACA_API_SECRET')
    
    # Print all environment variables to help debug
    print("Environment variables available:")
    for key, value in os.environ.items():
        if 'KEY' in key or 'SECRET' in key or 'TOKEN' in key:
            print(f"  {key}: {'*' * 4} (masked for security)")
        else:
            print(f"  {key}: {value}")
    
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
    
    # Alpaca API endpoints
    BASE_URL = "https://paper-api.alpaca.markets"
    
    # Use market leaders that are likely to have volume
    symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", "AMD"]
    
    # Headers for API requests
    headers = {
        'APCA-API-KEY-ID': API_KEY,
        'APCA-API-SECRET-KEY': API_SECRET,
        'Accept': 'application/json'
    }
    
    # Test API connection
    try:
        print(f"Testing API connection")
        account_url = f"{BASE_URL}/v2/account"
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
        print(f"API connection successful - Account ID: {account_data.get('id', 'unknown')}")
        print(f"Account status: {account_data.get('status', 'unknown')}")
        print(f"Account buying power: {account_data.get('buying_power', 'unknown')}")
    except Exception as e:
        print(f"API connection test error: {str(e)}")
        result = {
            'matches': [],
            'details': {},
            'errors': [f"API connection error: {str(e)}"]
        }
        print("RESULT_JSON_START")
        print(json.dumps(result))
        print("RESULT_JSON_END")
        return result
    
    # Process each symbol and get the latest data
    print(f"Processing {len(symbols)} symbols")
    
    # Use a very simple criterion - any stock with non-zero last price and volume
    # This should match all active stocks
    MIN_VOLUME = 1000  # Minimum volume threshold (very low to ensure matches)
    
    for symbol in symbols:
        try:
            # Get latest trade
            print(f"Requesting latest trade for {symbol}")
            trade_url = f"{BASE_URL}/v2/stocks/{symbol}/trades/latest"
            
            trade_response = requests.get(trade_url, headers=headers)
            print(f"{symbol} trade response status: {trade_response.status_code}")
            
            if trade_response.status_code != 200:
                print(f"Error fetching trade for {symbol}: {trade_response.status_code}")
                errors.append(f"Error fetching trade for {symbol}: {trade_response.status_code}")
                # Try to get the full error message
                try:
                    error_text = trade_response.text
                    print(f"Error details: {error_text}")
                except:
                    print("Could not get error details")
                continue
            
            # Parse JSON response
            trade_data = trade_response.json()
            
            # Print the full response for debugging
            print(f"Full trade data for {symbol}: {json.dumps(trade_data)}")
            
            # Extract price and size
            price = trade_data.get('trade', {}).get('p')
            size = trade_data.get('trade', {}).get('s')
            timestamp = trade_data.get('trade', {}).get('t')
            
            if price is None or size is None:
                print(f"Missing price or size data for {symbol}")
                errors.append(f"Missing price or size data for {symbol}")
                continue
            
            # Format timestamp if available
            if timestamp:
                timestamp_str = datetime.fromtimestamp(timestamp / 1e9).strftime('%Y-%m-%d %H:%M:%S')
            else:
                timestamp_str = "Unknown"
            
            print(f"{symbol} - Price: ${price:.2f}, Size: {size}, Time: {timestamp_str}")
            
            # Check if size (volume) is above threshold
            if size >= MIN_VOLUME:
                matches.append(symbol)
                details[symbol] = {
                    "price": float(price),
                    "volume": int(size),
                    "timestamp": timestamp_str,
                    "reason": f"Trading volume of {size} shares meets minimum threshold of {MIN_VOLUME}"
                }
                
                print(f"✓ MATCH: {symbol} - Volume of {size} exceeds minimum threshold of {MIN_VOLUME}")
            else:
                print(f"× NO MATCH: {symbol} - Volume of {size} is below threshold of {MIN_VOLUME}")
                
        except Exception as e:
            print(f"Error processing {symbol}: {str(e)}")
            import traceback
            print(traceback.format_exc())
            errors.append(f"Error processing {symbol}: {str(e)}")
    
    # If no matches found, provide a detailed explanation
    if not matches:
        print("No stocks found with sufficient trading volume")
        print("This could be due to market hours, API limits, or network issues")
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
        'errors': errors
    }
    
    # Print with special markers for proper extraction
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    
    return result