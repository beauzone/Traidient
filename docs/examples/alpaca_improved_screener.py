import os
import requests
import pandas as pd
import numpy as np
import json
from datetime import datetime, timedelta

def screen_stocks(data_dict):
    """
    An improved version of the Alpaca-based screener with better error handling
    and no default fallback to AAPL
    """
    print("=" * 50)
    print("IMPROVED ALPACA API SCREENER")
    print("=" * 50)
    
    # Initialize results
    matches = []
    details = {}
    
    # Configure Alpaca API access
    API_KEY = os.environ.get('ALPACA_API_KEY')
    API_SECRET = os.environ.get('ALPACA_API_SECRET')
    
    # Print debugging info
    print(f"Data dictionary contains {len(data_dict)} items")
    if len(data_dict) > 0:
        print(f"Sample symbols: {list(data_dict.keys())[:5]}")
    
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
    
    # List of stocks to screen (common large cap tech stocks)
    symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", "AMD", "INTC", "IBM"]
    
    # Headers for API requests
    headers = {
        'APCA-API-KEY-ID': API_KEY,
        'APCA-API-SECRET-KEY': API_SECRET,
        'Accept': 'application/json'
    }
    
    # Test API connection to make sure we can reach the Alpaca API
    try:
        account_url = f"{BASE_URL}/v2/account"
        print(f"Testing API connection with account endpoint")
        
        account_response = requests.get(account_url, headers=headers)
        
        if account_response.status_code != 200:
            print(f"API connection test failed: {account_response.status_code}")
            result = {
                'matches': [],
                'details': {"error": f"Alpaca API connection failed: {account_response.text}"}
            }
            print("RESULT_JSON_START")
            print(json.dumps(result))
            print("RESULT_JSON_END")
            return result
            
        account_data = account_response.json()
        print(f"API connection successful - Account ID: {account_data.get('id', 'unknown')}")
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
    
    # Get the current market prices using a snapshot endpoint
    try:
        # Try getting multiple symbols in one request
        snapshot_url = f"{BASE_URL}/v2/stocks/snapshots"
        params = {'symbols': ','.join(symbols)}
        
        print(f"Fetching current snapshot for {len(symbols)} symbols")
        snapshot_response = requests.get(snapshot_url, headers=headers, params=params)
        
        # If multi-symbol endpoint fails, try single symbol approach
        if snapshot_response.status_code != 200:
            print(f"Snapshot API call failed with status {snapshot_response.status_code}")
            print(f"Switching to individual symbol snapshot requests")
            
            for symbol in symbols:
                try:
                    single_snapshot_url = f"{BASE_URL}/v2/stocks/{symbol}/snapshot"
                    symbol_response = requests.get(single_snapshot_url, headers=headers)
                    
                    if symbol_response.status_code != 200:
                        print(f"Failed to get snapshot for {symbol}: {symbol_response.status_code}")
                        continue
                    
                    snapshot_data = symbol_response.json()
                    
                    # Extract the current price and volume
                    current_price = snapshot_data.get('latestTrade', {}).get('p')
                    if not current_price:
                        current_price = snapshot_data.get('minuteBar', {}).get('c')
                    
                    current_volume = snapshot_data.get('minuteBar', {}).get('v')
                    
                    if current_price and current_price > 100.0:  # Simple price threshold
                        matches.append(symbol)
                        details[symbol] = {
                            "price": float(current_price),
                            "volume": float(current_volume) if current_volume else 0,
                            "reason": f"Price ${current_price} is above $100"
                        }
                        print(f"MATCH: {symbol} - Price {current_price} is above threshold")
                except Exception as symbol_error:
                    print(f"Error processing {symbol}: {str(symbol_error)}")
        else:
            # Process the multi-symbol snapshot response
            snapshot_data = snapshot_response.json()
            
            for symbol, data in snapshot_data.items():
                try:
                    # Extract the current price and volume
                    current_price = data.get('latestTrade', {}).get('p')
                    if not current_price:
                        current_price = data.get('minuteBar', {}).get('c')
                    
                    current_volume = data.get('minuteBar', {}).get('v')
                    
                    if current_price and current_price > 100.0:  # Simple price threshold
                        matches.append(symbol)
                        details[symbol] = {
                            "price": float(current_price),
                            "volume": float(current_volume) if current_volume else 0,
                            "reason": f"Price ${current_price} is above $100"
                        }
                        print(f"MATCH: {symbol} - Price {current_price} is above threshold")
                except Exception as symbol_error:
                    print(f"Error processing {symbol}: {str(symbol_error)}")
    
    except Exception as e:
        print(f"Error fetching snapshots: {str(e)}")
    
    # Important: No default fallback to AAPL here
    
    # Print final result count
    print(f"Found {len(matches)} matching stocks")
    
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