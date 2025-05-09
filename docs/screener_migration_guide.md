# Screener Migration Guide

This guide explains how to migrate existing screeners from using the Alpaca API directly to using Yahoo Finance data, which is more reliable in our execution environment.

## Why Migrate?

We've found that direct Alpaca API calls from Python screeners may encounter issues in our execution environment:

1. API rate limits can be reached quickly
2. Authentication and request formatting issues
3. Cross-environment limitations

Using Yahoo Finance (`yfinance`) as the data source provides several advantages:
- More reliable data access
- No authentication required
- Simpler API
- Works consistently in our environment

## Step-by-Step Migration Process

### 1. Update Imports

Replace Alpaca API imports with `yfinance`:

```python
# OLD - Remove these
import requests
import os
from datetime import datetime, timedelta

# NEW - Add these
import yfinance as yf
```

Keep these imports:
```python
import pandas as pd
import numpy as np
import json
```

### 2. Remove Alpaca API Credentials

Remove all code related to Alpaca API credentials:

```python
# REMOVE THIS CODE
API_KEY = os.environ.get('ALPACA_API_KEY')
API_SECRET = os.environ.get('ALPACA_API_SECRET')

# Verify we have API credentials
if not API_KEY or not API_SECRET:
    print("ERROR: Alpaca API credentials not found in environment")
    # ...error handling code...
```

### 3. Replace Data Fetching Code

Replace Alpaca API data fetching with `yfinance`:

```python
# OLD - Remove this code
bars_url = f"{BASE_URL}/v2/stocks/{symbol}/bars"
params = {
    'start': start_str,
    'end': end_str,
    'timeframe': '1D',
    'limit': 30
}
response = requests.get(bars_url, headers=headers, params=params)
bars_data = response.json()
df = pd.DataFrame(bars_data['bars'])
```

Replace with:

```python
# NEW - Add this code
# Get data from Yahoo Finance 
stock = yf.Ticker(symbol)
df = stock.history(period="50d")  # Adjust period as needed
```

### 4. Update Data Field References

Update column name references:

| Alpaca Data | Yahoo Finance Data |
|-------------|-------------------|
| `df['t']`   | Index (datetime)  |
| `df['o']`   | `df['Open']`      |
| `df['h']`   | `df['High']`      |
| `df['l']`   | `df['Low']`       |
| `df['c']`   | `df['Close']`     |
| `df['v']`   | `df['Volume']`    |

### 5. Keep the Result Format Unchanged

Make sure your final result still follows this format with the special markers:

```python
# This code stays the same
result = {
    'matches': matches,
    'details': details
}

print("RESULT_JSON_START")
print(json.dumps(result))
print("RESULT_JSON_END")

return result
```

## Example Before & After

### Before (Alpaca API)

```python
import os
import requests
import pandas as pd
import json
from datetime import datetime, timedelta

def screen_stocks(data_dict):
    # Configure Alpaca API
    API_KEY = os.environ.get('ALPACA_API_KEY')
    API_SECRET = os.environ.get('ALPACA_API_SECRET')
    
    # API call code
    bars_url = f"{BASE_URL}/v2/stocks/{symbol}/bars"
    response = requests.get(bars_url, headers=headers, params=params)
    bars_data = response.json()
    
    # Process data
    df = pd.DataFrame(bars_data['bars'])
    latest_price = df.iloc[-1]['c']
    
    # Return results
    # ...
```

### After (Yahoo Finance)

```python
import pandas as pd
import json
import yfinance as yf

def screen_stocks(data_dict):
    # Yahoo Finance data retrieval
    stock = yf.Ticker(symbol)
    df = stock.history(period="30d")
    
    # Process data
    latest_price = df.iloc[-1]['Close']
    
    # Return results
    # ...
```

## Complete Example

See `docs/examples/yahoofinance_rsi_macd_screener.py` for a complete example of a migrated screener.