# Stock Screener Best Practices

## Critical Requirements for All Screeners

The most important rule for all screeners in this system is that **they must explicitly print the results to stdout with special markers**. This is how the Node.js backend extracts the results from the Python execution.

### Required Result Format

Every screener must include this code just before returning:

```python
# Prepare result
result = {
    'matches': matches,  # List of symbol strings that match criteria
    'details': details,  # Dictionary with details for each matching symbol
    'errors': errors if errors else None  # List of error messages or None
}

# CRITICAL: Print with special markers for proper extraction
print("RESULT_JSON_START")
print(json.dumps(result))
print("RESULT_JSON_END")

return result
```

The Node.js backend looks for the text between `RESULT_JSON_START` and `RESULT_JSON_END` in the stdout stream, not the actual return value from the Python function.

### Screener Function Signature

Every screener must have a `screen_stocks` function that accepts a `data_dict` parameter:

```python
def screen_stocks(data_dict):
    """
    Function documentation here
    """
    # Screening logic
    
    # ...
    
    # Return and print results with markers
    result = {
        'matches': matches,
        'details': details,
        'errors': errors if errors else None
    }
    
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    
    return result
```

## Using the Universal Screener Wrapper

For more robust error handling, you can use the `universal_screener_wrapper.py` to wrap any screener function:

```python
from universal_screener_wrapper import run_screener_with_markers

def my_screen_function(params):
    # Your screening logic here
    # ...
    
    return {
        'matches': matches,
        'details': details,
        'errors': errors if errors else None
    }

if __name__ == "__main__":
    import sys
    
    # Default empty parameters
    params = {}
    
    # If parameters file path is provided as argument
    if len(sys.argv) > 1:
        param_file = sys.argv[1]
        try:
            with open(param_file, 'r') as f:
                params = json.load(f)
        except Exception as e:
            print(f"Error loading parameters file: {e}")
    
    # Run the screener with proper markers
    run_screener_with_markers(my_screen_function, params)
```

## Required Result Structure

The result object must have this structure:

```python
{
    'matches': [
        'AAPL',
        'MSFT',
        # ... other symbol strings
    ],
    'details': {
        'AAPL': {
            # Any details you want to include
            'price': 190.5,
            'reason': 'Price above threshold'
        },
        'MSFT': {
            # ... details for other symbols
        }
    },
    'errors': [
        # Any error messages, or None if no errors
        'Error processing GOOG: API rate limit exceeded'
    ]
}
```

## Debugging Tips

1. Add extensive print statements to see what's happening during execution
2. Make sure to handle all exceptions to avoid silent failures
3. Print parameter values to verify they're being received correctly
4. Test your screener directly with Python before running it through the app
5. Always verify that the result JSON is properly formatted