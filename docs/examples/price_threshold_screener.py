import os
import json
import requests
from datetime import datetime, timedelta

def screen_stocks(data_dict):
    """
    Super simple price threshold screener
    Returns stocks trading above $100 per share
    """
    print("=" * 50)
    print("SIMPLE PRICE THRESHOLD SCREENER")
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
    
    # List of stocks to screen
    symbols = [
        "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", "AMD", "INTC", "JPM", 
        "BAC", "GS", "V", "MA", "PYPL", "NFLX", "DIS", "CSCO", "T", "VZ"
    ]
    
    # Alpaca API endpoints
    BASE_URL = "https://paper-api.alpaca.markets"
    PRICE_THRESHOLD = 100.0  # Screen for stocks above $100 per share
    
    # Headers for API requests
    headers = {
        'APCA-API-KEY-ID': API_KEY,
        'APCA-API-SECRET-KEY': API_SECRET,
        'Accept': 'application/json'
    }
    
    # Test account API first to verify connection
    try:
        account_url = f"{BASE_URL}/v2/account"
        account_response = requests.get(account_url, headers=headers)
        
        if account_response.status_code != 200:
            print(f"API connection test failed: {account_response.status_code}")
            print("RESULT_JSON_START")
            print(json.dumps({
                'matches': [],
                'details': {"error": f"API connection failed: {account_response.text}"}
            }))
            print("RESULT_JSON_END")
            return {'matches': [], 'details': {"error": "API connection failed"}}
            
        print("API connection successful")
        
        # Now get the latest quotes for all symbols
        for symbol in symbols:
            try:
                quote_url = f"{BASE_URL}/v2/stocks/{symbol}/quotes/latest"
                quote_response = requests.get(quote_url, headers=headers)
                
                if quote_response.status_code != 200:
                    print(f"Error fetching quote for {symbol}: {quote_response.status_code}")
                    continue
                
                quote_data = quote_response.json()
                if not quote_data.get('quote'):
                    print(f"No quote data found for {symbol}")
                    continue
                
                # Get the ask price (or bid if ask is not available)
                ask_price = quote_data['quote'].get('ap')
                bid_price = quote_data['quote'].get('bp')
                
                # If ask price is not available, use bid price
                price = ask_price if ask_price else bid_price
                
                print(f"{symbol} - Current price: ${price}")
                
                # Check if price meets our threshold
                if price and price > PRICE_THRESHOLD:
                    matches.append(symbol)
                    details[symbol] = {
                        "price": price,
                        "above_threshold": True,
                        "threshold": PRICE_THRESHOLD
                    }
                    print(f"MATCH: {symbol} - Price ${price} is above ${PRICE_THRESHOLD}")
            
            except Exception as e:
                print(f"Error processing {symbol}: {str(e)}")
    
    except Exception as e:
        print(f"API connection error: {str(e)}")
        print("RESULT_JSON_START")
        print(json.dumps({
            'matches': [],
            'details': {"error": f"API connection error: {str(e)}"}
        }))
        print("RESULT_JSON_END")
        return {'matches': [], 'details': {"error": f"API connection error: {str(e)}"}}
    
    # If no matches found, explain why
    if not matches:
        print(f"No stocks trading above ${PRICE_THRESHOLD} found")
    
    # Print final result count
    print(f"Found {len(matches)} stocks trading above ${PRICE_THRESHOLD}")
    
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