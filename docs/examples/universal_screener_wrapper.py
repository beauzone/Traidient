"""
Universal screener wrapper for handling output formatting and error handling.
This module can be imported to simplify screener development.
"""

import json
import sys
import traceback
from typing import Dict, List, Any, Callable, Optional, Union


def screener_wrapper(screen_func: Callable) -> Callable:
    """
    Decorator that wraps any screener function to handle output formatting and errors.
    
    Example usage:
    
    from universal_screener_wrapper import screener_wrapper
    
    @screener_wrapper
    def screen_stocks(data_dict):
        # Your screening logic here
        matches = []
        details = {}
        for symbol, data in data_dict.items():
            if meets_criteria(data):
                matches.append(symbol)
                details[symbol] = {"reason": "Your reasoning here"}
        
        return matches, details
    """
    def wrapper(data_dict: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
        try:
            # Call the screener function
            result = screen_func(data_dict)
            
            # Handle different return formats
            if isinstance(result, tuple) and len(result) >= 2:
                # Screener returned (matches, details)
                matches, details = result[0], result[1]
                errors = None if len(result) < 3 else result[2]
            elif isinstance(result, dict) and "matches" in result:
                # Screener returned full result dict
                return format_output(result)
            elif isinstance(result, list):
                # Screener returned just a list of matches
                matches, details = result, {}
                errors = None
            else:
                raise ValueError(f"Unexpected return format from screener: {type(result)}")
            
            # Format the result
            formatted_result = {
                "matches": matches,
                "details": details,
                "errors": errors
            }
            
            return format_output(formatted_result)
            
        except Exception as e:
            # Capture the full exception info
            error_msg = str(e)
            stack_trace = traceback.format_exc()
            
            print(f"Error in screener: {error_msg}")
            print(f"Stack trace: {stack_trace}")
            
            # Return error result
            error_result = {
                "matches": [],
                "details": {},
                "errors": error_msg
            }
            
            return format_output(error_result)
    
    return wrapper


def format_output(result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format and print the result with markers and flush stdout.
    """
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    sys.stdout.flush()  # CRUCIAL: ensures output is captured
    
    return result


# Example of usage
if __name__ == "__main__":
    # Create a simple test screener
    @screener_wrapper
    def example_screener(data_dict):
        matches = []
        details = {}
        
        for symbol, data in data_dict.items():
            if data.get("price", 0) > 100:
                matches.append(symbol)
                details[symbol] = {
                    "price": data["price"],
                    "reason": "Price greater than $100"
                }
        
        return matches, details
    
    # Test data
    test_data = {
        "AAPL": {"price": 175.50, "volume": 35000000},
        "MSFT": {"price": 310.25, "volume": 20000000},
        "GOOG": {"price": 140.50, "volume": 15000000},
        "XYZ": {"price": 50.75, "volume": 5000000}
    }
    
    # Run the screener
    result = example_screener(test_data)
    print("Screener returned:", result)