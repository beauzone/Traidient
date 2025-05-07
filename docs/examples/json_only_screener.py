import pandas as pd
import json
from datetime import datetime

def screen_stocks(data_dict):
    """
    Test screener that ensures ONLY the final JSON is printed
    """
    # Create a list to store debug messages instead of printing
    debug_logs = []
    debug_logs.append(f"Processing {len(data_dict)} symbols")
    
    # Process each stock
    matches = []
    for symbol, df in data_dict.items():
        try:
            if df is not None and not df.empty and 'Close' in df.columns:
                # Get latest price
                price = float(df['Close'].iloc[-1])
                
                # Always add this stock as a match
                match_info = {
                    "symbol": symbol,
                    "price": price,
                    "details": f"Test match with price ${price:.2f}"
                }
                matches.append(match_info)
                debug_logs.append(f"Added {symbol} at ${price:.2f}")
        except Exception as e:
            debug_logs.append(f"Error with {symbol}: {str(e)}")
    
    debug_logs.append(f"Found {len(matches)} matching stocks")
    
    # Create the screen_stocks return format
    result = {
        'matches': matches,
        'details': {
            'screener_name': 'JSON-Only Test',
            'description': 'Ensures only JSON output',
            'total': len(matches),
            'debug_logs': debug_logs  # Include logs in the actual JSON
        }
    }
    
    # This is what screen_stocks returns
    return result

# IMPORTANT: If this script is run directly, we need to:
# 1. Output ONLY a single valid JSON string
# 2. Format it according to what the server expects
if __name__ == "__main__":
    try:
        # Simulate some test data
        test_matches = [
            {
                "symbol": "AAPL",
                "price": 200.50,
                "details": "Test match"
            },
            {
                "symbol": "MSFT", 
                "price": 350.75,
                "details": "Test match"
            }
        ]
        
        # This is what the server expects as the ONLY output
        server_result = {
            "success": True,
            "screener_id": 999,
            "matches": test_matches,
            "details": {
                "screener_name": "JSON-Only Test",
                "total": len(test_matches)
            },
            "execution_time": 0.5,
            "timestamp": datetime.now().isoformat()
        }
        
        # ONLY print the server-expected JSON - no debug prints!
        print(json.dumps(server_result))
        
    except Exception as e:
        # Only output a valid JSON error response
        error_result = {
            "success": False,
            "error": str(e),
            "matches": [],
            "details": {},
            "execution_time": 0,
            "timestamp": datetime.now().isoformat()
        }
        print(json.dumps(error_result))