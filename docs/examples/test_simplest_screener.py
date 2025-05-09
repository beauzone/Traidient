import json
import sys

def screen_stocks(data_dict):
    """
    The simplest possible screener that just returns a fixed result.
    Using the proper marker approach with stdout flushing.
    """
    print("Running absolute minimal test screener")
    
    # Static test data
    matches = ["AAPL", "MSFT", "GOOG"]
    details = {
        "AAPL": {"price": 190.25, "reason": "Test match"},
        "MSFT": {"price": 415.78, "reason": "Test match"},
        "GOOG": {"price": 180.45, "reason": "Test match"}
    }
    
    # Prepare result
    result = {
        'matches': matches,
        'details': details,
        'errors': None
    }
    
    # Print result with markers AND flush stdout
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    sys.stdout.flush()  # CRUCIAL: ensures output is captured before process exits
    
    return result

# For testing directly
if __name__ == "__main__":
    result = screen_stocks({})
    print("Result returned:", result)