#!/usr/bin/env python3
import sys
import json

# The user code
user_code = """
def screen_stocks(data_dict):
    """
    Super simple test screener with minimal dependencies
    """
    print("Running super simple test screener")
    
    # Just return a basic result
    matches = ["AAPL", "MSFT", "GOOGL"]
    
    print("Test completed successfully")
    
    return {
        'matches': matches,
        'details': {
            'test': 'This is a super simple test'
        }
    }
"""

# Create a minimal test data dictionary
data_dict = {
    "AAPL": {},
    "MSFT": {},
    "GOOGL": {}
}

# Execute the user code in a try-except block to catch any errors
try:
    # Define the function in the current scope
    exec(user_code)
    
    # Call the screen_stocks function
    result = locals()["screen_stocks"](data_dict)
    
    # Print the result with special markers for easy extraction
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
except Exception as e:
    # Print the error with the special markers
    print(f"Error: {str(e)}")
    print("RESULT_JSON_START")
    print(json.dumps({
        "matches": [],
        "details": {"error": str(e)}
    }))
    print("RESULT_JSON_END")
