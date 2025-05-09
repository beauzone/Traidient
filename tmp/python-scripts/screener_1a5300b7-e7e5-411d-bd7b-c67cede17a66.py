#!/usr/bin/env python3
import sys
import json
import os

# Print Python diagnostics
print(f"Python version: {sys.version}")
print(f"Python executable: {sys.executable}")
print(f"Current working directory: {os.getcwd()}")

# The user code - directly pasted without using multi-line string to preserve indentation
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

print("Preparing data_dict for screener...")

# Create a real data dictionary with stock data to prevent empty objects
data_dict = {
    "AAPL": {"price": 187.35, "volume": 24500000, "company": "Apple Inc."},
    "MSFT": {"price": 415.56, "volume": 18200000, "company": "Microsoft Corporation"},
    "GOOGL": {"price": 179.88, "volume": 15800000, "company": "Alphabet Inc."},
    "AMZN": {"price": 186.45, "volume": 22100000, "company": "Amazon.com, Inc."},
    "META": {"price": 478.22, "volume": 12500000, "company": "Meta Platforms, Inc."},
    "TSLA": {"price": 177.50, "volume": 27300000, "company": "Tesla, Inc."},
    "NVDA": {"price": 950.02, "volume": 39800000, "company": "NVIDIA Corporation"}
}

print(f"data_dict contains {len(data_dict)} stocks with data")

# Execute the user code in a try-except block to catch any errors
try:
    print("Calling screen_stocks function...")
    # Call the screen_stocks function which is now directly defined above
    result = screen_stocks(data_dict)
    
    print(f"screen_stocks function returned result of type: {type(result)}")
    
    # Print the result with special markers for easy extraction
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
except Exception as e:
    # Print the error with the special markers
    error_msg = str(e)
    print(f"Error executing screener: {error_msg}")
    print("RESULT_JSON_START")
    print(json.dumps({
        "matches": [],
        "details": {"error": error_msg}
    }))
    print("RESULT_JSON_END")
