# Best Practices for Stock Screeners

This guide outlines the best practices for creating reliable stock screeners that work with our platform's Python execution service.

## Key Requirements for All Screeners

1. **Entry Point Function**
   - All screeners must define a `screen_stocks(data_dict)` function that accepts a dictionary of stock data.
   - This function must return a dictionary with `matches` and `details` keys.

2. **Result Format**
   - Your screener must return a dictionary with two keys:
     - `matches`: A list of symbol strings (e.g., `["AAPL", "MSFT"]`)
     - `details`: A dictionary with symbols as keys and details as values

3. **Special Results Markers**
   - Include the special markers to ensure reliable result extraction:
   ```python
   print("RESULT_JSON_START")
   print(json.dumps(result))  # result is your dictionary with matches and details
   print("RESULT_JSON_END")
   ```

4. **Error Handling**
   - Always include try-except blocks around API calls and data processing
   - Return empty matches with an error detail on failure:
   ```python
   return {
       'matches': [],
       'details': {"error": str(error_message)}
   }
   ```

## Self-Contained Screeners

For screeners that fetch their own data (recommended for complex technical indicators):

1. **API Access**
   - Use environment variables for API keys
   ```python
   API_KEY = os.environ.get('ALPACA_API_KEY')
   API_SECRET = os.environ.get('ALPACA_API_SECRET')
   ```

2. **Verify API Keys**
   - Always check that API keys exist and provide a meaningful error if missing
   ```python
   if not API_KEY or not API_SECRET:
       print("ERROR: API credentials not found in environment")
       return {'matches': [], 'details': {"error": "API credentials not found"}}
   ```

3. **Data Fetching**
   - Clearly handle API request errors with try-except blocks
   - Verify you have enough data points before calculating indicators

4. **Logging**
   - Use print statements for debugging important steps
   - Log API responses for troubleshooting

## Example: Minimal Working Screener

```python
import json
import os

def screen_stocks(data_dict):
    """
    A minimal working screener example
    """
    # Initialize results
    matches = []
    details = {}
    
    try:
        # Your screening logic here
        # For example, a simple price screener:
        for symbol, data in data_dict.items():
            if "price" in data and data["price"] > 100:
                matches.append(symbol)
                details[symbol] = {
                    "price": data["price"],
                    "reason": "Price above $100"
                }
        
        # Print result with special markers
        result = {'matches': matches, 'details': details}
        print("RESULT_JSON_START")
        print(json.dumps(result))
        print("RESULT_JSON_END")
        
        return result
    
    except Exception as e:
        error_result = {
            'matches': [],
            'details': {"error": str(e)}
        }
        print("RESULT_JSON_START")
        print(json.dumps(error_result))
        print("RESULT_JSON_END")
        
        return error_result
```

## Troubleshooting Common Issues

1. **Empty Results**
   - Check if your data_dict contains the expected data
   - Verify that your filtering criteria aren't too strict
   - Add more debug print statements to trace data flow

2. **API Errors**
   - Verify API credentials exist as environment variables
   - Check API response status codes
   - Handle rate limiting with retries if necessary

3. **Execution Errors**
   - Include try-except blocks around all code that might fail
   - Log intermediate calculation results for technical indicators
   - Check for division by zero or NaN values

4. **Result Parsing Issues**
   - Always include the special result markers
   - Ensure your result can be serialized to JSON (no custom objects)
   - Keep your return format consistent