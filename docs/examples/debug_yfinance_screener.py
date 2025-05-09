import json
import sys
import time

def screen_stocks(data_dict):
    """
    Debug screener to investigate why yfinance isn't working properly
    """
    print(f"DEBUG SCREENER: Analyzing data provided to screen_stocks")
    print(f"Python version: {sys.version}")
    print(f"Python executable: {sys.executable}")
    
    # First, check if we're getting placeholder data
    has_placeholder = False
    for symbol, data in data_dict.items():
        if data.get('is_placeholder', False):
            has_placeholder = True
            break
    
    print(f"Is using placeholder data: {has_placeholder}")
    
    # Try to import and use yfinance directly
    print("\nAttempting to import and use yfinance directly from within the screener:")
    try:
        import yfinance as yf
        print("✓ Successfully imported yfinance from within the screener")
        
        # Try to fetch a single quote as a test
        try:
            ticker = yf.Ticker("AAPL")
            info = ticker.fast_info
            if hasattr(info, 'last_price'):
                price = info.last_price
            else:
                price = info.previous_close
                
            print(f"✓ Successfully fetched AAPL price from yfinance: {price}")
            
            # Try another stock to verify
            ticker = yf.Ticker("MSFT")
            info = ticker.fast_info
            if hasattr(info, 'last_price'):
                price = info.last_price
            else:
                price = info.previous_close
                
            print(f"✓ Successfully fetched MSFT price from yfinance: {price}")
        except Exception as e:
            print(f"✗ Failed to fetch stock data directly: {str(e)}")
            
        # Try the download method as a fallback
        try:
            print("Attempting yf.download()...")
            data = yf.download("SPY", period="1d")
            price = data['Close'].iloc[-1] if not data.empty else None
            print(f"✓ Successfully fetched SPY data via download: {price}")
        except Exception as e:
            print(f"✗ Failed to use yf.download(): {str(e)}")
            
    except ImportError as e:
        print(f"✗ Failed to import yfinance: {str(e)}")
    except Exception as e:
        print(f"✗ Unexpected error when using yfinance: {str(e)}")
    
    # Print environment info
    try:
        import os
        import sys
        print("\nEnvironment variables:")
        for key, value in os.environ.items():
            if key.startswith('PYTHON') or key.startswith('PATH'):
                print(f"  {key}: {value}")
        
        print("\nPython path:")
        for p in sys.path:
            print(f"  {p}")
    except Exception as e:
        print(f"Error checking environment: {str(e)}")
    
    # Check for network connectivity
    try:
        import urllib.request
        print("\nTesting network connectivity:")
        response = urllib.request.urlopen("https://query1.finance.yahoo.com", timeout=5)
        print(f"✓ Yahoo Finance API is reachable, status: {response.status}")
    except Exception as e:
        print(f"✗ Network connectivity test failed: {str(e)}")
        
    # Analyze provided data
    print("\nAnalyzing provided data_dict:")
    for symbol, data in list(data_dict.items())[:3]:  # Show first 3 stocks only
        print(f"  {symbol}: {data}")
    
    # Create basic result
    result = {
        "matches": list(data_dict.keys())[:5],  # Just use first 5 symbols
        "details": {symbol: {"source": "debug_screener", "data": data} 
                   for symbol, data in list(data_dict.items())[:5]}
    }
    
    # Print debug info for data
    print(f"\nDebug report complete. Found {len(data_dict)} symbols in data_dict.")
    
    # Print with markers for extraction
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    sys.stdout.flush()
    
    return result