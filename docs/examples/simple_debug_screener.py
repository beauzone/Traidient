import os
import traceback

def screen_stocks(data_dict):
    """
    A super simple screener for debugging purposes only
    """
    print("=" * 50)
    print("SIMPLE DEBUG SCREENER RUNNING")
    print("=" * 50)
    
    matches = []
    details = {}
    
    # Check if any data is passed to the screener
    print(f"Data dict type: {type(data_dict)}")
    print(f"Data dict empty? {not data_dict}")
    if data_dict:
        print(f"Data dict keys: {list(data_dict.keys())}")
        print(f"Number of symbols: {len(data_dict)}")
        
        for symbol in data_dict:
            print(f"Symbol: {symbol}")
            df = data_dict.get(symbol)
            if df is not None:
                print(f"  DataFrame shape: {df.shape}")
                print(f"  DataFrame columns: {list(df.columns)}")
            else:
                print(f"  Data for {symbol} is None")
    else:
        print("Data dict is empty or None")
    
    # Check environment variables
    api_key = os.environ.get('ALPACA_API_KEY')
    api_secret = os.environ.get('ALPACA_API_SECRET')
    
    print(f"ALPACA_API_KEY exists? {api_key is not None}")
    print(f"ALPACA_API_SECRET exists? {api_secret is not None}")
    
    # List all environment variables (safely)
    print("\nAll environment variables (names only):")
    for key in os.environ.keys():
        print(f"  {key}")
    
    # Simply return AAPL as a match for testing
    ticker = "AAPL"
    matches.append(ticker)
    details[ticker] = {
        "price": 200.0,
        "score": 75.0,
        "details": "Test match for debugging"
    }
    
    print("\nSimple debug screener completed")
    print("=" * 50)
    
    return {
        'matches': matches,
        'details': details
    }