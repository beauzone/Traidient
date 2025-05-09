import os
import requests
import json
from datetime import datetime

def screen_stocks(data_dict):
    """
    Simple price threshold screener
    Finds stocks above a certain price threshold
    """
    print("=" * 50)
    print("PRICE THRESHOLD SCREENER")
    print("Finds stocks trading above $150")
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
    
    # Alpaca API endpoints
    BASE_URL = "https://paper-api.alpaca.markets"
    
    # List of stocks to screen
    # Deliberately including a mix of high and low priced stocks
    symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", "F", "T", "BAC", "NFLX"]
    
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
        account_response = requests.get(account_url, headers=headers)
        
        if account_response.status_code != 200:
            print(f"API connection test failed: {account_response.status_code}")
            result = {
                'matches': [],
                'details': {},
                'errors': [f"API connection failed: {account_response.text}"]
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
            'details': {},
            'errors': [f"API connection error: {str(e)}"]
        }
        print("RESULT_JSON_START")
        print(json.dumps(result))
        print("RESULT_JSON_END")
        return result
    
    # Simple price threshold to check for
    PRICE_THRESHOLD = 150.0
    print(f"Checking for stocks priced above ${PRICE_THRESHOLD}")
    
    # Loop through symbols and get current prices
    for symbol in symbols:
        try:
            # Get latest quote
            quote_url = f"{BASE_URL}/v2/stocks/{symbol}/quotes/latest"
            
            print(f"Requesting latest quote for {symbol}")
            response = requests.get(quote_url, headers=headers)
            
            if response.status_code != 200:
                print(f"Error fetching quote for {symbol}: {response.status_code}")
                errors.append(f"Error fetching quote for {symbol}: {response.status_code}")
                continue
            
            # Parse JSON response
            quote_data = response.json()
            
            # Extract ask price (or bid if ask not available)
            ask_price = quote_data.get('quote', {}).get('ap')
            bid_price = quote_data.get('quote', {}).get('bp')
            
            # Use midpoint if both available, otherwise use whichever is available
            if ask_price and bid_price:
                current_price = (ask_price + bid_price) / 2
            elif ask_price:
                current_price = ask_price
            elif bid_price:
                current_price = bid_price
            else:
                print(f"No price data available for {symbol}")
                errors.append(f"No price data available for {symbol}")
                continue
            
            timestamp = quote_data.get('quote', {}).get('t')
            if timestamp:
                timestamp_str = datetime.fromtimestamp(timestamp / 1e9).strftime('%Y-%m-%d %H:%M:%S')
            else:
                timestamp_str = "Unknown"
            
            print(f"{symbol} - Current price: ${current_price:.2f}, Time: {timestamp_str}")
            
            # Check if price is above threshold
            if current_price > PRICE_THRESHOLD:
                matches.append(symbol)
                details[symbol] = {
                    "price": float(current_price),
                    "timestamp": timestamp_str,
                    "threshold": PRICE_THRESHOLD,
                    "reason": f"Price ${current_price:.2f} is above ${PRICE_THRESHOLD:.2f} threshold"
                }
                
                print(f"✓ MATCH: {symbol} - Price ${current_price:.2f} exceeds threshold of ${PRICE_THRESHOLD:.2f}")
            else:
                print(f"× NO MATCH: {symbol} - Price ${current_price:.2f} is below threshold of ${PRICE_THRESHOLD:.2f}")
                
        except Exception as e:
            print(f"Error processing {symbol}: {str(e)}")
            errors.append(f"Error processing {symbol}: {str(e)}")
    
    # If no matches found, print a clear message but don't add any default data
    if not matches:
        print("No stocks found trading above the price threshold")
    
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