# Best Practices for Stock Screeners

This guide outlines best practices for creating reliable stock screeners using Alpaca API.

## Core Principles

1. **No Default Fallbacks**: Never add default stocks to your results if no matches are found.
2. **Use Special Markers**: Always use `RESULT_JSON_START` and `RESULT_JSON_END` to mark your results.
3. **Handle Errors Gracefully**: Catch and report errors instead of crashing.
4. **Test API Connection**: Verify API connectivity before making other API calls.
5. **Document Your Logic**: Include clear comments explaining your screening criteria.

## Screener Structure

### 1. Basic Template

```python
import os
import requests
import pandas as pd
import json
from datetime import datetime, timedelta

def screen_stocks(data_dict):
    # Initialize result containers
    matches = []
    details = {}
    errors = []
    
    # API setup code
    
    # Test API connection
    
    # Processing logic
    
    # Final result preparation
    result = {
        'matches': matches,
        'details': details,
        'errors': errors if errors else None
    }
    
    # Special markers for extraction
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    
    return result
```

### 2. API Setup

```python
# Configure Alpaca API access
API_KEY = os.environ.get('ALPACA_API_KEY')
API_SECRET = os.environ.get('ALPACA_API_SECRET')

# Verify we have API credentials
if not API_KEY or not API_SECRET:
    print("ERROR: Alpaca API credentials not found")
    result = {
        'matches': [],
        'details': {},
        'errors': ["Alpaca API credentials not found"]
    }
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    return result

# Headers for API requests
headers = {
    'APCA-API-KEY-ID': API_KEY,
    'APCA-API-SECRET-KEY': API_SECRET,
    'Accept': 'application/json'
}
```

### 3. Connection Testing

```python
# Test API connection before making other calls
try:
    account_url = f"{BASE_URL}/v2/account"
    account_response = requests.get(account_url, headers=headers)
    
    if account_response.status_code != 200:
        # Handle connection error
        return error_result
except Exception as e:
    # Handle exception
    return error_result
```

### 4. Error Handling

```python
try:
    # API call or data processing code
except Exception as e:
    print(f"Error: {str(e)}")
    errors.append(f"Error: {str(e)}")
    # Continue with next item or return error result
```

## Specific Scenarios

### 1. Getting Historical Data

```python
# Get last 30 days of daily bars
end_date = datetime.now()
start_date = end_date - timedelta(days=30)

# Format dates as ISO strings
start_str = start_date.strftime('%Y-%m-%d')
end_str = end_date.strftime('%Y-%m-%d')

# API request
bars_url = f"{BASE_URL}/v2/stocks/{symbol}/bars"
params = {
    'start': start_str,
    'end': end_str,
    'timeframe': '1D',
    'limit': 30
}
response = requests.get(bars_url, headers=headers, params=params)

# Check if enough data points
if not bars_data.get('bars') or len(bars_data['bars']) < 14:
    print(f"Not enough data for {symbol}")
    continue
```

### 2. Getting Latest Quotes

```python
# Get latest quote
quote_url = f"{BASE_URL}/v2/stocks/{symbol}/quotes/latest"
response = requests.get(quote_url, headers=headers)

# Extract price data
ask_price = quote_data.get('quote', {}).get('ap')
bid_price = quote_data.get('quote', {}).get('bp')

# Use midpoint or whatever is available
if ask_price and bid_price:
    current_price = (ask_price + bid_price) / 2
elif ask_price:
    current_price = ask_price
elif bid_price:
    current_price = bid_price
else:
    print(f"No price data available for {symbol}")
    continue
```

### 3. Technical Indicators

```python
# Calculate RSI
delta = df['c'].diff()
gain = delta.clip(lower=0)
loss = -delta.clip(upper=0)

avg_gain = gain.rolling(window=14).mean()
avg_loss = loss.rolling(window=14).mean()

rs = avg_gain / avg_loss
rsi = 100 - (100 / (1 + rs))

# Calculate MACD
ema12 = df['c'].ewm(span=12, adjust=False).mean()
ema26 = df['c'].ewm(span=26, adjust=False).mean()

macd_line = ema12 - ema26
signal_line = macd_line.ewm(span=9, adjust=False).mean()
```

## Common Pitfalls

1. **Not Checking Data Completeness**: Always verify you have enough data points before calculating indicators.

2. **Default Fallbacks**: NEVER add default stocks to results when no matches are found. It creates confusion about whether the screener is working properly.

3. **Missing Error Handling**: Wrap API calls in try/except blocks and include the error info in results.

4. **Not Using Result Markers**: Always include the special markers for proper result extraction:
   ```python
   print("RESULT_JSON_START")
   print(json.dumps(result))
   print("RESULT_JSON_END")
   ```

5. **Forgetting Type Conversion**: Convert NumPy/Pandas types to Python native types for JSON serialization:
   ```python
   "price": float(latest['c']),
   "volume": int(latest['v']),
   ```

## Example Screeners

For complete working examples, see:

1. `docs/examples/price_threshold_screener.py` - Simple price-based screener
2. `docs/examples/clean_simple_screener.py` - Moving average screener
3. `docs/examples/alpaca_rsi_macd_improved.py` - RSI-MACD momentum screener