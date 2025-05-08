#!/usr/bin/env python3
import sys
import json

# The user code - directly pasted without using multi-line string to preserve indentation
def screen_stocks(data_dict):
    """
    Super simple test screener with absolute minimal code
    """
    # Just return a hardcoded match
    # No docstring at all, just return a hardcoded match 
    return {
        'matches': ['AAPL', 'MSFT'],
        'details': {

# Create a test data dictionary with common stocks
data_dict = {
    "AAPL": {},
    "MSFT": {},
    "GOOGL": {},
    "AMZN": {},
    "META": {},
    "TSLA": {},
    "NVDA": {}
}

# Execute the user code in a try-except block to catch any errors
try:
    # Call the screen_stocks function which is now directly defined above
    result = screen_stocks(data_dict)
    
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
