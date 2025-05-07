import pandas as pd
import json

def screen_stocks(data_dict):
    """
    A minimal test screener that will return all stocks it receives.
    The platform will call this function with a dictionary of dataframes.
    
    This version is designed to be maximally compatible with server expectations.
    """
    # Print key debugging information that should appear in server logs
    print("*** SCREENER START ***")
    print(f"DATA RECEIVED: {len(data_dict)} stocks")
    
    # Create a very simple result structure
    matches = []
    
    # Process symbols
    if data_dict:
        print(f"First few symbols: {list(data_dict.keys())[:5]}")
        for symbol, df in data_dict.items():
            if df is not None and not df.empty and 'Close' in df.columns:
                # Get latest price
                price = float(df['Close'].iloc[-1])
                
                # Always match this stock
                match_info = {
                    "symbol": symbol,
                    "price": price,
                    "details": f"Test match with price ${price:.2f}"
                }
                matches.append(match_info)
                print(f"Added match: {symbol} at ${price:.2f}")
    else:
        print("WARNING: No data received in data_dict")
    
    # Create the expected return format
    result = {
        'matches': matches,
        'details': {
            'screener_name': 'Minimal Server Test',
            'description': 'Tests server compatibility',
            'total': len(matches)
        }
    }
    
    # Print the entire result structure to debug output
    print(f"RETURNING {len(matches)} MATCHES")
    print(f"RESULT STRUCTURE: {json.dumps(result)}")
    print("*** SCREENER END ***")
    
    # Return in the expected format
    return result