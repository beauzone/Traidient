import os
import json
import sys

def screen_stocks(data_dict):
    """
    An ultra-simple screener for debugging purposes only
    Always returns AAPL with debug information
    """
    # Diagnostic info
    print("DEBUG SCREENER RUNNING")
    print(f"Python version: {sys.version}")
    print(f"Python executable: {sys.executable}")
    print(f"Current working directory: {os.getcwd()}")
    print(f"data_dict type: {type(data_dict)}")
    print(f"data_dict length: {len(data_dict)}")
    
    if len(data_dict) > 0:
        # Print first 3 keys if any exist
        sample_keys = list(data_dict.keys())[:3]
        print(f"Sample keys: {sample_keys}")
        
        # Print sample data for first key
        if sample_keys:
            first_key = sample_keys[0]
            print(f"Sample data for {first_key}: {data_dict[first_key]}")
    
    # Environment check
    print("\nEnvironment variables check:")
    for key in ['ALPACA_API_KEY', 'ALPACA_API_SECRET']:
        value = os.environ.get(key)
        exists = value is not None
        print(f"  {key} exists: {exists}")
        if exists and value:
            print(f"  {key} length: {len(value)}")
    
    # Always return AAPL for debugging
    matches = ["AAPL"]
    details = {
        "AAPL": {
            "price": 200.0,
            "reason": "This is a debug screener",
            "data_dict_was_empty": len(data_dict) == 0
        }
    }
    
    # Print special markers for result JSON extraction
    print("\nRESULT_JSON_START")
    print(json.dumps({
        'matches': matches,
        'details': details
    }))
    print("RESULT_JSON_END")
    
    # Return is technically optional but good practice
    return {
        'matches': matches,
        'details': details
    }

# For direct execution testing
if __name__ == "__main__":
    test_data = {
        "AAPL": {"price": 187.35},
        "MSFT": {"price": 415.56}
    }
    result = screen_stocks(test_data)
    print(f"Direct execution result: {result}")