import pandas as pd
import numpy as np
import ta
import os
import requests
import json
import time

def screen_stocks(data_dict):
    """
    A screener that uses Alpaca API to get real market data
    """
    print("Starting Alpaca-Powered Screener")
    
    # Will hold our matching symbols and details
    matches = []
    details = {}
    
    # Configure Alpaca API access (these should be available from environment variables)
    ALPACA_API_KEY = os.environ.get('ALPACA_API_KEY')
    ALPACA_API_SECRET = os.environ.get('ALPACA_API_SECRET')
    
    if not ALPACA_API_KEY or not ALPACA_API_SECRET:
        print("Alpaca API credentials not found in environment")
        return {'matches': [], 'details': {}}
    
    print("Alpaca API credentials found")
    
    # Alpaca API endpoints
    ALPACA_BASE_URL = "https://paper-api.alpaca.markets"  # Use paper trading endpoint
    MARKET_DATA_URL = "https://data.alpaca.markets"
    
    # Headers for API requests
    headers = {
        'APCA-API-KEY-ID': ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
        'Accept': 'application/json'
    }
    
    # Use a smaller set of common tickers
    tickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "META"]
    print(f"Checking the following tickers: {', '.join(tickers)}")
    
    # Get market data for these tickers
    for ticker in tickers:
        try:
            print(f"Processing {ticker}...")
            
            # Get latest bar data from Alpaca
            endpoint = f"{MARKET_DATA_URL}/v2/stocks/{ticker}/bars"
            params = {
                'timeframe': '1Day',
                'limit': 1,
                'adjustment': 'raw'
            }
            
            response = requests.get(endpoint, headers=headers, params=params)
            
            if response.status_code != 200:
                print(f"Error accessing Alpaca API for {ticker}: {response.status_code}")
                print(f"Response: {response.text}")
                continue
                
            data = response.json()
            
            if 'bars' not in data or not data['bars']:
                print(f"No bar data found for {ticker}")
                continue
                
            # Get the latest bar
            latest_bar = data['bars'][0]
            current_price = latest_bar['c']  # Closing price
            
            print(f"Got data for {ticker}: Price=${current_price}")
            
            # Get some additional information about the ticker
            endpoint = f"{ALPACA_BASE_URL}/v2/assets/{ticker}"
            response = requests.get(endpoint, headers=headers)
            
            if response.status_code == 200:
                asset_data = response.json()
                print(f"Asset info: {asset_data['name']}, Tradable: {asset_data['tradable']}")
            else:
                print(f"Couldn't get asset info for {ticker}")
                asset_data = {'name': ticker}
            
            # Simple criteria: price > $100
            if current_price > 100:
                matches.append(ticker)
                
                details[ticker] = {
                    "price": float(current_price),
                    "name": asset_data.get('name', ticker),
                    "score": 85.0,
                    "details": f"Price: ${round(current_price, 2)}"
                }
                
                print(f"✓ {ticker} matched with price ${current_price}")
            else:
                print(f"✗ {ticker} price ${current_price} below threshold")
                
        except Exception as e:
            print(f"Error processing {ticker}: {str(e)}")
            continue
    
    print(f"Screener found {len(matches)} matches with REAL data: {', '.join(matches)}")
    
    # Return in the expected format - with empty lists if no matches
    return {
        'matches': matches,
        'details': details
    }