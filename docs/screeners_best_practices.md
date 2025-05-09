# Stock Screener Best Practices

## Structure & Output Format

Every screener should implement a `screen_stocks(data_dict)` function that returns results in the following format:

```python
{
    "matches": ["AAPL", "MSFT", ...],  # List of ticker symbols that match criteria
    "details": {                        # Optional detailed information about matches
        "AAPL": {
            "price": 175.50,            # Current price
            "score": 95,                # Optional score or ranking
            "reason": "Description of why this matched"  # Optional explanation
        },
        ...
    },
    "errors": None  # Or error message if something went wrong
}
```

## Critical Implementation Details

### 1. Always include stdout flushing

```python
import json
import sys

def screen_stocks(data_dict):
    # Your screening logic here...
    
    result = {
        "matches": [...],
        "details": {...}
    }
    
    # ALWAYS include these lines, exactly as shown:
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    sys.stdout.flush()  # CRUCIAL: ensures output is captured before process exits
    
    return result
```

**Important**: The `sys.stdout.flush()` line is critical for reliable operation. Without it, the screener might appear to work in testing but fail in production.

### 2. Error Handling

Always wrap your core logic in try/except blocks:

```python
def screen_stocks(data_dict):
    try:
        # Your screening logic here...
        
        # Format result properly
        result = {
            "matches": matched_symbols,
            "details": details_dict
        }
        
        # Proper output with markers and flush
        print("RESULT_JSON_START")
        print(json.dumps(result))
        print("RESULT_JSON_END")
        sys.stdout.flush()
        
        return result
        
    except Exception as e:
        error_msg = str(e)
        result = {
            "matches": [],
            "details": {},
            "errors": error_msg
        }
        
        # Still properly output even with errors
        print("RESULT_JSON_START")
        print(json.dumps(result))
        print("RESULT_JSON_END")
        sys.stdout.flush()
        
        return result
```

### 3. Data Dictionary Format

The `data_dict` parameter will contain stock data in this format:

```python
{
    "AAPL": {
        "price": 175.50,
        "volume": 35000000,
        "company": "Apple Inc."
        # ... other properties
    },
    "MSFT": {
        # ...
    }
}
```

Use this data for screening rather than making your own API calls when possible.

## Example Screener Template

```python
import json
import sys

def screen_stocks(data_dict):
    """
    Screen stocks based on price and volume criteria
    """
    try:
        # Your screening logic
        matches = []
        details = {}
        
        for symbol, data in data_dict.items():
            # Example criteria
            if data["price"] > 100 and data["volume"] > 1000000:
                matches.append(symbol)
                details[symbol] = {
                    "price": data["price"],
                    "volume": data["volume"],
                    "reason": "High price and volume"
                }
        
        # Prepare result
        result = {
            "matches": matches,
            "details": details,
            "errors": None
        }
        
        # Output with markers AND flush stdout
        print("RESULT_JSON_START")
        print(json.dumps(result))
        print("RESULT_JSON_END")
        sys.stdout.flush()  # CRUCIAL
        
        return result
        
    except Exception as e:
        error_msg = str(e)
        print(f"Error in screener: {error_msg}")
        
        # Return error result
        result = {
            "matches": [],
            "details": {},
            "errors": error_msg
        }
        
        print("RESULT_JSON_START")
        print(json.dumps(result))
        print("RESULT_JSON_END")
        sys.stdout.flush()
        
        return result
```

## Testing Your Screener

You can add this at the end of your file to allow local testing:

```python
# Optional local test - runs when script is executed directly
if __name__ == "__main__":
    test_data = {
        "AAPL": {"price": 175.50, "volume": 35000000},
        "MSFT": {"price": 310.25, "volume": 20000000},
        "GOOG": {"price": 140.50, "volume": 15000000}
    }
    result = screen_stocks(test_data)
    print("Test result:", result)
```