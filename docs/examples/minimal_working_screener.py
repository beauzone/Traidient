import json
import sys

def screen_stocks(data_dict):
    """
    The absolute simplest screener possible.
    No external imports, no data processing, just returns hardcoded results.
    """
    print("Starting minimal screener")
    
    # Hard-coded results for testing
    matches = ["AAPL", "MSFT", "GOOGL"]
    details = {
        "AAPL": {
            "symbol": "AAPL",
            "price": 175.50,
            "score": 95,
            "details": "Hardcoded test data"
        },
        "MSFT": {
            "symbol": "MSFT", 
            "price": 415.75,
            "score": 92,
            "details": "Hardcoded test data"
        },
        "GOOGL": {
            "symbol": "GOOGL",
            "price": 165.30,
            "score": 89,
            "details": "Hardcoded test data"
        }
    }
    
    # Format the results
    result = {
        "matches": matches,
        "details": details
    }
    
    # Output with the required markers
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    sys.stdout.flush()
    
    return result