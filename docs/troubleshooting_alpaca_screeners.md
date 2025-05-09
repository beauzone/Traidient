# Troubleshooting Alpaca API Screeners

This guide provides solutions to common issues with Alpaca API-based screeners.

## Common Issues and Solutions

### 1. Default Fallback to AAPL

**Problem**: Screeners are only returning AAPL as a match regardless of market conditions.

**Solution**: 
- Remove any default fallback code that adds AAPL when no matches are found
- Make sure your screener either returns actual matches or an empty array
- Check the code path that runs when API calls fail

```python
# REMOVE THIS CODE - It causes false positives
if not matches:
    # Add AAPL as a default match for testing
    matches = ["AAPL"]
    details["AAPL"] = { ... }
```

### 2. Special Result Markers

**Problem**: Results aren't being properly extracted from the Python output.

**Solution**:
- Add clear special markers around your JSON result
- Format the output exactly as shown below:

```python
# Print with special markers for proper extraction
print("RESULT_JSON_START")
print(json.dumps(result))
print("RESULT_JSON_END")

return result
```

### 3. API Error Handling

**Problem**: API errors aren't properly caught and handled.

**Solution**:
- Test the API connection before making other API calls
- Handle each API call in a separate try/except block
- Include detailed error messages in the result

```python
try:
    response = requests.get(url, headers=headers, params=params)
    
    if response.status_code != 200:
        print(f"API call failed: {response.status_code}")
        # Return empty result with error message
except Exception as e:
    print(f"Exception during API call: {str(e)}")
    # Return empty result with error message
```

### 4. Data Validation

**Problem**: Calculations fail because of missing or invalid data.

**Solution**:
- Check data values before using them in calculations
- Verify you have enough data points for indicators
- Add proper null/undefined checks

```python
# Make sure we have enough data
if not bars_data.get('bars') or len(bars_data['bars']) < 14:
    print(f"Not enough data for {symbol}, skipping")
    continue
```

### 5. Result Format

**Problem**: Results can't be properly parsed from JSON.

**Solution**:
- Use simple data types that can be serialized to JSON
- Convert NumPy or Pandas types to Python types
- Format the result object consistently

```python
# Convert data types for JSON serialization
details[symbol] = {
    "price": float(latest['c']),
    "rsi": float(rsi_value),
    "volume": int(latest['v']),
    "reasons": match_reasons  # List of strings
}
```

## Debugging Techniques

### 1. Verbose Logging

Add detailed logging at each step to see where the issue occurs:

```python
print(f"Processing {symbol}")
print(f"API response status: {response.status_code}")
print(f"Received {len(data)} data points")
print(f"Calculated RSI: {rsi_value}")
```

### 2. Test API Connection

Always test the API connection first:

```python
account_url = f"{BASE_URL}/v2/account"
account_response = requests.get(account_url, headers=headers)

if account_response.status_code != 200:
    # API is not accessible
```

### 3. Simplified Screener

Create a simplified version of your screener to isolate issues:

```python
def screen_stocks(data_dict):
    # Initialize results
    matches = []
    details = {}
    
    # Hard-code a simple condition
    price_threshold = 100.0
    
    # Test with a fixed set of symbols
    for symbol in ["AAPL", "MSFT", "GOOGL"]:
        # Simple API call
        # Simple condition check
        
    # Return result with markers
```

## Example Improved Screener

See `docs/examples/alpaca_improved_screener.py` for a complete example of a fixed screener.