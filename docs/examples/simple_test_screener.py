import json
import yfinance as yf

def screen_stocks(data_dict):
    """
    Extremely simple test screener to diagnose marker extraction
    """
    try:
        # Initialize results
        matches = []
        details = {}
        errors = []
        
        # Get Apple stock data
        stock = yf.Ticker("AAPL")
        current_price = stock.history(period="1d")['Close'].iloc[-1]
        
        print(f"Got AAPL price: ${current_price:.2f}")
        
        # Just add AAPL to matches
        matches.append("AAPL")
        details["AAPL"] = {
            "price": float(current_price),
            "reason": "Test match"
        }
        
        # Prepare the result dictionary
        result = {
            'matches': matches,
            'details': details,
            'errors': errors if errors else None
        }
        
        # Print the result with markers in six different ways to see which ones work
        
        # Method 1: Basic markers with newlines (most common)
        print("\nMETHOD 1: Basic markers with newlines")
        print("RESULT_JSON_START")
        print(json.dumps(result))
        print("RESULT_JSON_END")
        
        # Method 2: Markers on same line as JSON
        print("\nMETHOD 2: Markers on same line as JSON")
        print("RESULT_JSON_START " + json.dumps(result) + " RESULT_JSON_END")
        
        # Method 3: Using triple quotes for everything
        print("\nMETHOD 3: Using triple quotes for everything")
        print(f"""RESULT_JSON_START
{json.dumps(result)}
RESULT_JSON_END""")
        
        # Method 4: With extra whitespace
        print("\nMETHOD 4: With extra whitespace")
        print("  RESULT_JSON_START  ")
        print(json.dumps(result))
        print("  RESULT_JSON_END  ")
        
        # Method 5: Using .write() directly
        print("\nMETHOD 5: Using sys.stdout.write()")
        import sys
        sys.stdout.write("RESULT_JSON_START\n")
        sys.stdout.write(json.dumps(result) + "\n")
        sys.stdout.write("RESULT_JSON_END\n")
        
        # Method 6: Print without newlines
        print("\nMETHOD 6: Print without newlines")
        print("RESULT_JSON_START", end="")
        print(json.dumps(result), end="")
        print("RESULT_JSON_END")
        
        # Return the result dictionary (this will be ignored by the Node.js service)
        return result
    except Exception as e:
        print(f"Error in screener: {str(e)}")
        # Even on error, make sure to print with markers
        error_result = {
            'matches': [],
            'details': {},
            'errors': [f"Error in screener: {str(e)}"]
        }
        print("RESULT_JSON_START")
        print(json.dumps(error_result))
        print("RESULT_JSON_END")
        
        # Return the error result (this will be ignored by the Node.js service)
        return error_result