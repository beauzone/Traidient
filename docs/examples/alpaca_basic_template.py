import os
import requests
import pandas as pd
import json
from datetime import datetime, timedelta

def screen_stocks(data_dict):
    """
    Basic Alpaca-powered screener template that you can customize.
    This provides the foundation for creating reliable screeners with real data.
    """
    print("Starting Basic Alpaca Screener")
    
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
    BASE_URL = "https://paper-api.alpaca.markets"
    DATA_URL = "https://data.alpaca.markets"
    
    # Headers for API requests
    headers = {
        'APCA-API-KEY-ID': ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
        'Accept': 'application/json'
    }
    
    # Define which tickers to screen - start with a manageable list
    tickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "META"]
    print(f"Checking {len(tickers)} tickers")
    
    # Calculate date ranges for historical data
    end_date = datetime.now()
    start_date = (end_date - timedelta(days=30)).strftime("%Y-%m-%d")
    end_date = end_date.strftime("%Y-%m-%d")
    
    for ticker in tickers:
        try:
            print(f"Processing {ticker}...")
            
            # Get current quote data
            quote_endpoint = f"{DATA_URL}/v2/stocks/{ticker}/quotes/latest"
            quote_response = requests.get(quote_endpoint, headers=headers)
            
            if quote_response.status_code != 200:
                print(f"Error getting quote for {ticker}: {quote_response.status_code}")
                continue
                
            quote_data = quote_response.json()
            if 'quote' not in quote_data:
                print(f"No quote data for {ticker}")
                continue
                
            current_price = quote_data['quote']['ap']  # Ask price
            print(f"{ticker} current price: ${current_price}")
            
            # Get historical price data (last 30 days)
            bars_endpoint = f"{DATA_URL}/v2/stocks/{ticker}/bars"
            bars_params = {
                'timeframe': '1Day',
                'start': start_date,
                'end': end_date,
                'limit': 30,
                'adjustment': 'raw'
            }
            
            bars_response = requests.get(bars_endpoint, headers=headers, params=bars_params)
            
            if bars_response.status_code != 200:
                print(f"Error getting bars for {ticker}: {bars_response.status_code}")
                continue
                
            bars_data = bars_response.json()
            if 'bars' not in bars_data or not bars_data['bars']:
                print(f"No bars data for {ticker}")
                continue
            
            # Convert to DataFrame for analysis
            df = pd.DataFrame(bars_data['bars'])
            
            # Make sure we have date as index
            df['t'] = pd.to_datetime(df['t'])
            df.set_index('t', inplace=True)
            
            # Calculate some basic indicators
            # 1. Simple Moving Average (10-day)
            df['sma_10'] = df['c'].rolling(window=10).mean()
            
            # 2. Average Volume
            avg_volume = df['v'].mean()
            
            # 3. Highest price in period
            highest_price = df['h'].max()
            
            # 4. Lowest price in period
            lowest_price = df['l'].min()
            
            # 5. Price relative to range
            price_range = highest_price - lowest_price
            if price_range > 0:
                price_position = (current_price - lowest_price) / price_range * 100
            else:
                price_position = 50
                
            # Get the latest values
            latest = df.iloc[-1]
            
            # Check some simple criteria
            price_above_sma = current_price > latest['sma_10'] if not pd.isna(latest['sma_10']) else False
            near_high = price_position > 80  # Price is in top 20% of range
            volume_above_avg = latest['v'] > avg_volume
            
            # Adjust these criteria as needed for your own strategy
            # This is just a simple example
            if price_above_sma and (near_high or volume_above_avg):
                matches.append(ticker)
                
                # Create details object with relevant metrics
                details[ticker] = {
                    "price": float(current_price),
                    "sma_10": float(latest['sma_10']) if not pd.isna(latest['sma_10']) else 0,
                    "volume": float(latest['v']),
                    "avg_volume": float(avg_volume),
                    "price_position": float(price_position),
                    "score": float(price_position),  # Use price position as simple score
                    "details": f"Price: ${round(current_price, 2)}, Position: {round(price_position, 1)}%, Above SMA10: {price_above_sma}"
                }
                
                print(f"✓ {ticker} matched criteria")
            else:
                print(f"✗ {ticker} did not match criteria")
                
        except Exception as e:
            print(f"Error processing {ticker}: {str(e)}")
            continue
    
    print(f"Screener completed. Found {len(matches)} matches with real data.")
    
    # Return in the expected format - with empty lists if no matches
    return {
        'matches': matches,
        'details': details
    }