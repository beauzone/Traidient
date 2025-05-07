import pandas as pd
import json
import traceback
import sys

def screen_stocks(data_dict):
    """
    Test screener that focuses on JSON formatting to match server expectations
    """
    try:
        print("--- JSON FORMAT TEST SCREENER ---")
        print(f"Received {len(data_dict)} stocks")
        
        # Always return a hardcoded set of test results
        # This completely bypasses the actual data to test output format
        test_matches = [
            {
                "symbol": "AAPL",
                "price": 200.50,
                "score": 85.2,
                "details": "Test match from hardcoded results"
            },
            {
                "symbol": "MSFT",
                "price": 350.75,
                "score": 92.1,
                "details": "Test match from hardcoded results"
            },
            {
                "symbol": "GOOGL",
                "price": 175.25,
                "score": 78.9,
                "details": "Test match from hardcoded results"
            }
        ]
        
        # Create the expected format
        result = {
            "matches": test_matches,
            "details": {
                "screener_name": "JSON Format Test",
                "description": "Tests output compatibility",
                "total": len(test_matches)
            }
        }
        
        # Convert to and from JSON to ensure serialization is valid
        json_str = json.dumps(result)
        parsed_back = json.loads(json_str)
        
        # Print result for debugging
        print(f"Returning {len(test_matches)} hardcoded matches")
        print(f"JSON string: {json_str[:100]}...")
        
        return result
        
    except Exception as e:
        error_msg = f"ERROR in screener: {str(e)}"
        print(error_msg)
        traceback.print_exc(file=sys.stdout)
        
        # Return a minimal valid structure even on error
        return {
            "matches": [],
            "details": {
                "screener_name": "JSON Format Test (ERROR)",
                "error": error_msg,
                "total": 0
            }
        }