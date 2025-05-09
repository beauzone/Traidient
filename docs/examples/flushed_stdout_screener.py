import json
import sys

def screen_stocks(data_dict):
    """
    Minimal test screener that always returns a hardcoded match.
    Uses stdout flushing to ensure proper capture by the Node.js process.
    """
    print("Running flushed stdout screener")
    
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
    sys.stdout.flush()  # 🔥 CRUCIAL: ensures output is captured before process exits
    
    return result