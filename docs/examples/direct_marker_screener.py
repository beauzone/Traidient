import os
import json
import sys

def screen_stocks(data_dict):
    """
    Ultra-minimal screener that just prints diagnostic info and returns AAPL
    This includes the special markers that should be picked up by the Python execution service
    """
    print("DIAGNOSTIC MARKER SCREENER STARTING")
    print(f"Python version: {sys.version}")
    print(f"data_dict contents: {data_dict}")
    
    # Return a hardcoded result
    matches = ["AAPL"]
    details = {
        "AAPL": {
            "price": 200.0,
            "details": "Hardcoded result for direct marker test",
            "data_dict_was_empty": len(data_dict) == 0
        }
    }
    
    # Print with special markers for direct extraction
    print("RESULT_JSON_START")
    print(json.dumps({
        'matches': matches,
        'details': details
    }))
    print("RESULT_JSON_END")
    
    # Also return the result normally
    return {
        'matches': matches,
        'details': details
    }

# Allow direct execution for testing
if __name__ == "__main__":
    # Create a test data dictionary
    test_data = {
        "AAPL": {"price": 187.35},
        "MSFT": {"price": 415.56},
        "GOOGL": {"price": 179.88}
    }
    
    # Run the screener
    result = screen_stocks(test_data)
    print("Direct execution result:", result)