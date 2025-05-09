import json
import sys
import traceback
from typing import Dict, Any, Optional

def run_screener_with_markers(screener_func, params: Dict[str, Any] = {}) -> None:
    """
    Universal wrapper for any screener function to ensure proper stdout markers
    
    Args:
        screener_func: The screening function to call
        params: Parameters to pass to the screening function
    """
    try:
        # Call the actual screener function
        result = screener_func(params)
        
        # Ensure result is printed with the proper markers
        # This is critical for the Node.js backend to extract the result
        print("\nRESULT_JSON_START")
        print(json.dumps(result))
        print("RESULT_JSON_END\n")
    except Exception as e:
        # Capture any errors and format them properly
        error_info = {
            'matches': [],
            'details': {},
            'errors': [f"Critical error: {str(e)}"]
        }
        
        print(f"Critical error in screener: {str(e)}")
        traceback.print_exc()
        
        # Even on error, print with proper markers so Node.js can receive the error
        print("\nRESULT_JSON_START")
        print(json.dumps(error_info))
        print("RESULT_JSON_END\n")

if __name__ == "__main__":
    """
    Main entry point for command-line usage
    
    Format: python universal_screener_wrapper.py <screener_module> <params_file>
    
    - screener_module: Python module name containing a screen_stocks function
    - params_file: Path to JSON file with parameters (optional)
    """
    # Default empty parameters
    params = {}
    
    # Validate arguments
    if len(sys.argv) < 2:
        print("Usage: python universal_screener_wrapper.py <screener_module> <params_file>")
        sys.exit(1)
        
    # Load the screener module
    try:
        screener_module_name = sys.argv[1]
        module = __import__(screener_module_name)
        
        if not hasattr(module, 'screen_stocks'):
            raise ImportError(f"Module '{screener_module_name}' does not have a screen_stocks function")
            
        screener_func = module.screen_stocks
    except Exception as e:
        print(f"Error loading screener module: {str(e)}")
        error_info = {
            'matches': [],
            'details': {},
            'errors': [f"Failed to load screener module: {str(e)}"]
        }
        
        print("\nRESULT_JSON_START")
        print(json.dumps(error_info))
        print("RESULT_JSON_END\n")
        sys.exit(1)
    
    # Load parameters if provided
    if len(sys.argv) > 2:
        param_file = sys.argv[2]
        try:
            with open(param_file, 'r') as f:
                params = json.load(f)
        except Exception as e:
            print(f"Error loading parameters file: {e}")
    
    # Run the screener with proper result extraction
    run_screener_with_markers(screener_func, params)