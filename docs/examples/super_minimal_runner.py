#!/usr/bin/env python3
import json
import sys
import os
import traceback

"""
This is a super minimal runner script that:
1. Takes the user code as a string argument
2. Writes it to a temp file
3. Imports it safely
4. Executes the screen_stocks function
5. Returns the result as JSON
"""

def main():
    # Create a test data dictionary
    data_dict = {
        "AAPL": {},
        "MSFT": {},
        "GOOGL": {}
    }
    
    # Get the user code from command line argument
    if len(sys.argv) < 2:
        print("Error: Please provide the user code as an argument")
        sys.exit(1)
    
    user_code = sys.argv[1]
    
    # Write the user code to a temporary file
    module_path = "user_module.py"
    with open(module_path, "w") as f:
        f.write(user_code)
    
    try:
        # Dynamically import the module
        import importlib.util
        spec = importlib.util.spec_from_file_location("user_module", module_path)
        user_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(user_module)
        
        # Call the screen_stocks function
        result = user_module.screen_stocks(data_dict)
        
        # Print the result as JSON
        print("RESULT_JSON_START")
        print(json.dumps(result))
        print("RESULT_JSON_END")
        
    except Exception as e:
        print(f"Error executing user code: {str(e)}")
        traceback.print_exc()
        print("RESULT_JSON_START")
        print(json.dumps({
            'matches': [],
            'details': {'error': str(e)}
        }))
        print("RESULT_JSON_END")
    
    # Clean up the temporary file
    try:
        os.remove(module_path)
    except:
        pass

if __name__ == "__main__":
    main()