# Technical Stock Screener Guide

This guide explains how to create effective, self-contained technical stock screeners using the Alpaca API.

## Screener Architecture

All screeners follow a standard pattern:

1. Each screener is completely self-contained, fetching its own data from Alpaca API
2. The `screen_stocks()` function is the entry point that will be called by the system
3. All data fetching, indicator calculation, and screening logic happens within the screener
4. Results are returned in a standardized format

## Basic Screener Template

Here's the basic structure of a screener:

```python
import os
import requests
import pandas as pd
import numpy as np
import json
from datetime import datetime, timedelta
import time

def screen_stocks(data_dict):
    """
    A brief description of what this screener does
    """
    print("=" * 50)
    print("Starting My Custom Screener")
    print("=" * 50)
    
    # Initialize the results
    matches = []
    details = {}
    
    # Configure Alpaca API access
    API_KEY = os.environ.get('ALPACA_API_KEY')
    API_SECRET = os.environ.get('ALPACA_API_SECRET')
    
    # Verify we have API credentials
    if not API_KEY or not API_SECRET:
        print("ERROR: Alpaca API credentials not found in environment")
        return {'matches': [], 'details': {}}
    
    # Alpaca API endpoints
    BASE_URL = "https://paper-api.alpaca.markets"
    DATA_URL = "https://data.alpaca.markets"
    
    # Headers for API requests
    headers = {
        'APCA-API-KEY-ID': API_KEY,
        'APCA-API-SECRET-KEY': API_SECRET,
        'Accept': 'application/json'
    }
    
    # Define which stocks to screen
    tickers = ["AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA"]
    
    # Date range for historical data
    end_date = datetime.now()
    start_date = (end_date - timedelta(days=30)).strftime("%Y-%m-%d")
    end_date = end_date.strftime("%Y-%m-%d")
    
    # Process each ticker
    for ticker in tickers:
        try:
            # Get market data from Alpaca
            bars_endpoint = f"{DATA_URL}/v2/stocks/{ticker}/bars"
            bars_params = {
                'timeframe': '1Day',
                'start': start_date,
                'end': end_date,
                'adjustment': 'raw'
            }
            
            bars_response = requests.get(bars_endpoint, headers=headers, params=bars_params)
            
            # Convert to pandas DataFrame
            bars_data = bars_response.json()
            df = pd.DataFrame(bars_data['bars'])
            
            # Calculate technical indicators
            # ...your indicator calculations here...
            
            # Apply screening criteria
            if your_screening_condition:
                matches.append(ticker)
                details[ticker] = {
                    "price": float(current_price),
                    "indicator_value": float(some_value),
                    "details": "Description of why this matched"
                }
                
        except Exception as e:
            print(f"Error processing {ticker}: {str(e)}")
            continue
    
    # Return the results
    return {
        'matches': matches,
        'details': details
    }
```

## Return Format

Screeners must return results in the following format:

```python
{
    'matches': ['AAPL', 'MSFT', 'GOOGL'],  # List of ticker symbols that matched
    'details': {
        'AAPL': {
            'price': 185.34,               # Current price (required)
            'indicator_name': 72.5,        # Any relevant indicator values
            'details': 'Reason for match'  # Description (required)
        },
        'MSFT': {
            # Details for this match
        },
        # ... other matches
    }
}
```

## Logging and Debugging

Always use print statements liberally throughout your screener to help debug issues:

```python
print(f"Processing {ticker}...")
print(f"  Current price: ${current_price:.2f}")
print(f"  Indicator value: {indicator_value:.2f}")
```

## Best Practices

1. **Rate Limiting**: Alpaca has rate limits. Add pauses between requests:
   ```python
   if request_count % 5 == 0:
       time.sleep(0.2)  # 200ms pause every 5 requests
   ```

2. **Error Handling**: Always use try/except blocks to catch and log errors

3. **Data Validation**: Always check API responses and data quality before processing

4. **Performance**: Keep the ticker list reasonably sized to avoid timeouts

5. **Clear Documentation**: Document your screener's purpose and criteria in the docstring

## Example Screeners

Check the following example screeners for reference:

1. `rsi_macd_crossover_screener.py` - Identifies oversold stocks with MACD crossovers
2. `bollinger_breakout_screener.py` - Finds stocks breaking out of Bollinger Bands
3. `volume_spike_screener.py` - Detects unusual volume activity

## Troubleshooting

If your screener doesn't return expected results:

1. Check the logs for any error messages
2. Verify your API credentials are properly set in environment variables
3. Make sure your date ranges aren't too broad (causing timeouts) or too narrow (insufficient data)
4. Validate that your ticker list contains valid, tradable symbols
5. Ensure all mathematical calculations have checks for division by zero, NaN values, etc.

## Advanced Techniques

- Use `pandas-ta` library for more complex technical indicators
- Consider multiple timeframes for signals (e.g., daily and weekly)
- Implement scoring systems to rank matches by strength
- Add filters for minimum volume, price, or market cap