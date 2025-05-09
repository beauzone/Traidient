import os
import requests
import json
import sys

def screen_stocks(data_dict):
    """
    The absolute minimal screener - just returns AAPL and prints debug info
    No data analysis, no complex calculations, just direct API checks and returns a hardcoded match
    """
    print("=" * 80)
    print("ABSOLUTE MINIMAL SCREENER")
    print("This will output complete debugging information and always return AAPL")
    print("=" * 80)
    
    # Get and print environment variables (without exposing secrets)
    keys_to_check = ['ALPACA_API_KEY', 'ALPACA_API_SECRET']
    print("\nEnvironment Variable Check:")
    for key in keys_to_check:
        value = os.environ.get(key)
        print(f"  {key} exists: {value is not None}")
        if value:
            masked = value[:4] + "..." + value[-4:] if len(value) > 8 else "***" 
            print(f"  {key} value (masked): {masked}")
    
    # Get API keys from environment
    API_KEY = os.environ.get('ALPACA_API_KEY')
    API_SECRET = os.environ.get('ALPACA_API_SECRET')
    
    # Alpaca API endpoints
    BASE_URL = "https://paper-api.alpaca.markets"
    
    # Headers for API requests
    headers = {
        'APCA-API-KEY-ID': API_KEY,
        'APCA-API-SECRET-KEY': API_SECRET,
        'Accept': 'application/json'
    }
    
    # Make a simple API call to check authentication 
    print("\nAttempting basic Alpaca API call...")
    try:
        account_endpoint = f"{BASE_URL}/v2/account"
        print(f"Requesting: {account_endpoint}")
        
        # Make the request
        response = requests.get(account_endpoint, headers=headers)
        
        # Print the response
        print(f"Response status code: {response.status_code}")
        print(f"Response headers: {json.dumps(dict(response.headers))}")
        
        if response.status_code == 200:
            account_data = response.json()
            print(f"Account ID: {account_data.get('id')}")
            print(f"Account status: {account_data.get('status')}")
            print(f"Account currency: {account_data.get('currency')}")
            print("Authentication successful!")
        else:
            print(f"Authentication failed: {response.text}")
    except Exception as e:
        print(f"API call failed with error: {str(e)}")
    
    # Return a hardcoded result no matter what
    matches = ["AAPL"]
    details = {
        "AAPL": {
            "price": 200.0,
            "details": "Hardcoded result for debugging"
        }
    }
    
    print("\nReturning hardcoded result with AAPL")
    print("=" * 80)
    
    # Return a manually constructed dictionary (standard format expected by system)
    result = {
        'matches': matches,
        'details': details
    }
    
    # Special markers for extraction
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    
    return result

# If this script is run directly, execute the screen_stocks function with a simple data dictionary
if __name__ == "__main__":
    print("Executing script directly")
    # Create a test data dictionary with common stocks
    data_dict = {
        "AAPL": {},
        "MSFT": {},
        "GOOGL": {},
        "AMZN": {},
        "META": {},
        "TSLA": {},
        "NVDA": {}
    }
    result = screen_stocks(data_dict)
    print("Final result:", result)