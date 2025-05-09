import os
import requests
import pandas as pd
import numpy as np
import json
import traceback
from datetime import datetime, timedelta

def screen_stocks(data_dict):
    """
    An improved RSI-MACD screener using Alpaca API
    Key improvements:
    1. Better error handling
    2. No default fallback to AAPL
    3. More robust API calls
    4. Clear result markers
    """
    print("=" * 50)
    print("IMPROVED RSI-MACD SCREENER (ALPACA VERSION)")
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
    
    print(f"API credentials available")
    
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
    
    # Test API connection
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
    
    # Market data endpoint with parameters
    # Get 30 days of daily bars for calculating indicators
    end_date = datetime.now()
    start_date = end_date - timedelta(days=40)  # Get 40 days of data
    
    # Format dates as ISO strings
    start_str = start_date.strftime('%Y-%m-%d')
    end_str = end_date.strftime('%Y-%m-%d')
    
    print(f"Fetching data from {start_str} to {end_str} for {len(symbols)} symbols")
    
    # Store API call statistics
    successful_calls = 0
    api_errors = 0
    
    for symbol in symbols:
        try:
            # Build the URL for fetching daily bars
            bars_url = f"{BASE_URL}/v2/stocks/{symbol}/bars"
            params = {
                'start': start_str,
                'end': end_str,
                'timeframe': '1D',
                'limit': 40
            }
            
            print(f"Requesting data for {symbol}")
            
            # Make the API request
            response = requests.get(bars_url, headers=headers, params=params)
            
            if response.status_code != 200:
                print(f"Error fetching data for {symbol}: {response.status_code} - {response.text}")
                api_errors += 1
                continue
            
            # Parse the JSON response
            bars_data = response.json()
            successful_calls += 1
            
            # Check if we have enough data
            if not bars_data.get('bars') or len(bars_data['bars']) < 26:
                print(f"Not enough data for {symbol}, skipping (need at least 26 bars)")
                continue
            
            # Convert to pandas DataFrame
            df = pd.DataFrame(bars_data['bars'])
            
            # Print first few entries to verify data
            print(f"Received {len(df)} bars for {symbol}")
            
            # Convert timestamp to datetime
            df['t'] = pd.to_datetime(df['t'])
            
            # Set timestamp as index
            df.set_index('t', inplace=True)
            
            # Calculate RSI (14-period)
            print(f"Calculating RSI for {symbol}")
            delta = df['c'].diff()
            gain = delta.clip(lower=0)
            loss = -delta.clip(upper=0)
            
            avg_gain = gain.rolling(window=14).mean()
            avg_loss = loss.rolling(window=14).mean()
            
            rs = avg_gain / avg_loss
            rsi = 100 - (100 / (1 + rs))
            
            # Calculate MACD (12, 26, 9)
            print(f"Calculating MACD for {symbol}")
            ema12 = df['c'].ewm(span=12, adjust=False).mean()
            ema26 = df['c'].ewm(span=26, adjust=False).mean()
            
            macd_line = ema12 - ema26
            signal_line = macd_line.ewm(span=9, adjust=False).mean()
            
            # Add indicators to the DataFrame
            df['rsi'] = rsi
            df['macd_line'] = macd_line
            df['signal_line'] = signal_line
            
            # Get the latest values
            latest = df.iloc[-1]
            previous = df.iloc[-2]
            
            # Check for bullish RSI and MACD conditions
            rsi_value = latest['rsi']
            macd_over_signal = latest['macd_line'] > latest['signal_line']
            macd_crossover = (latest['macd_line'] > latest['signal_line']) and (previous['macd_line'] <= previous['signal_line'])
            
            # Print indicator values
            print(f"{symbol} - Current indicators:")
            print(f"  RSI: {rsi_value:.2f}")
            print(f"  MACD Line: {latest['macd_line']:.4f}")
            print(f"  Signal Line: {latest['signal_line']:.4f}")
            print(f"  MACD > Signal: {macd_over_signal}")
            print(f"  MACD Crossover: {macd_crossover}")
            
            # Define conditions for a match
            is_match = False
            match_reasons = []
            
            # RSI condition: Value between 40 and 70 (not overbought, but showing strength)
            if 40 <= rsi_value <= 70:
                match_reasons.append(f"RSI at {rsi_value:.2f} shows good momentum")
                
                # MACD conditions (only check if RSI condition is met)
                if macd_crossover:
                    match_reasons.append("Bullish MACD crossover (MACD line crossed above signal line)")
                    is_match = True
                elif macd_over_signal:
                    match_reasons.append("MACD line above signal line")
                    is_match = True
            
            # If this stock matches our criteria, add it to the results
            if is_match:
                matches.append(symbol)
                details[symbol] = {
                    "price": float(latest['c']),
                    "rsi": float(rsi_value),
                    "macd_line": float(latest['macd_line']),
                    "signal_line": float(latest['signal_line']),
                    "volume": int(latest['v']),
                    "reasons": match_reasons
                }
                
                print(f"✅ MATCH: {symbol} - {', '.join(match_reasons)}")
            else:
                print(f"❌ NO MATCH: {symbol} - Does not meet screening criteria")
        
        except Exception as e:
            print(f"Error processing {symbol}: {str(e)}")
            traceback.print_exc()
    
    print(f"API statistics: {successful_calls} successful calls, {api_errors} errors")
    
    # If no matches found, explain why but DO NOT add a default match
    if not matches:
        print("No stocks matched the RSI-MACD criteria")
        print("This could be due to current market conditions or API issues")
    
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