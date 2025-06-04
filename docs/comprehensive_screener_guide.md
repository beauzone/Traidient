# Comprehensive Stock Screener Development Guide

## Overview

This guide provides everything you need to develop custom stock screeners for our AI-powered trading platform. Screeners use Python to analyze market data and identify stocks that meet specific criteria.

## Screener Architecture

All screeners follow a standard pattern:

1. Each screener is completely self-contained, fetching its own data from Alpaca API
2. The `screen_stocks()` function is the entry point that will be called by the system
3. All data fetching, indicator calculation, and screening logic happens within the screener
4. Results are returned in a standardized format with special markers

## Entry Point Function

Every screener **must** have a `screen_stocks` function that serves as the main entry point:

```python
def screen_stocks(data_dict, parameters=None):
    """
    Main entry point for the screener
    
    Args:
        data_dict: Dictionary of pandas DataFrames with OHLCV data, keyed by symbol
        parameters: Optional dictionary of parameters to customize the screener
    
    Returns:
        str: JSON results with required markers
    """
    # Implementation goes here
    results = []
    
    # Return the results enclosed in special markers
    return format_results(results)
```

## Output Format Requirements

Screener results must be properly formatted with special markers for the platform to extract them:

```python
def format_results(results):
    """Format the results with the required markers"""
    import json
    
    json_str = json.dumps(results)
    
    # These markers are REQUIRED - they allow the platform to extract the results
    return f"RESULT_JSON_START\n{json_str}\nRESULT_JSON_END"
```

## Result Structure

Each screener result should be a dictionary with this structure:

```python
{
    "symbol": "AAPL",                   # Stock symbol (required)
    "score": 85,                        # Numeric score 0-100 (required)
    "recommendation": "BUY",            # Recommendation: BUY, SELL, NEUTRAL (required)
    "details": {                        # Additional details (optional)
        "rsi": 32.5,
        "macd": 0.25,
        "volume_spike": 2.3,
        # Any other relevant metrics
    },
    "price": 150.25,                    # Current price (optional)
    "target_price": 180.0,              # Target price (optional)
    "stop_loss": 140.0,                 # Suggested stop loss (optional)
    "timeframe": "1d",                  # Timeframe of the analysis (optional)
    "date": "2025-01-15T16:00:00",      # Analysis timestamp (optional)
    "strength": "STRONG",               # Signal strength: WEAK, MODERATE, STRONG (optional)
    "pattern": "Double Bottom",         # Identified pattern name (optional)
    "sector": "Technology"              # Stock sector (optional)
}
```

## Best Practices

### Core Principles

1. **No Default Fallbacks**: Never add default stocks to your results if no matches are found
2. **Use Special Markers**: Always use `RESULT_JSON_START` and `RESULT_JSON_END` to mark your results
3. **Handle Errors Gracefully**: Catch and report errors instead of crashing
4. **Test API Connection**: Verify API connectivity before making other API calls
5. **Document Your Logic**: Include clear comments explaining your screening criteria

### API Setup Template

```python
import os
import requests
import pandas as pd
import numpy as np
import pandas_ta as ta
import json
from datetime import datetime, timedelta

def screen_stocks(data_dict):
    """
    Brief description of what this screener does
    """
    print("=" * 50)
    print("Starting Custom Screener")
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
        return format_results([])
    
    # Alpaca API endpoints
    BASE_URL = "https://paper-api.alpaca.markets"
    DATA_URL = "https://data.alpaca.markets"
    
    # Headers for API requests
    headers = {
        'APCA-API-KEY-ID': API_KEY,
        'APCA-API-SECRET-KEY': API_SECRET,
        'Accept': 'application/json'
    }
    
    # Test API connection
    try:
        account_url = f"{BASE_URL}/v2/account"
        account_response = requests.get(account_url, headers=headers)
        
        if account_response.status_code != 200:
            print(f"ERROR: API connection failed with status {account_response.status_code}")
            return format_results([])
            
        print("✓ API connection successful")
        
    except Exception as e:
        print(f"ERROR: Failed to connect to Alpaca API: {e}")
        return format_results([])
    
    # Your screening logic here
    # ...
    
    return format_results(matches)
```

## Technical Indicators

Use `pandas_ta` for technical indicators:

```python
import pandas_ta as ta

def calculate_indicators(df):
    """Calculate technical indicators for a DataFrame"""
    # Create a copy to avoid modifying the original
    df = df.copy()
    
    # Calculate RSI
    df['rsi'] = ta.rsi(df['Close'], length=14)
    
    # Calculate MACD
    macd = ta.macd(df['Close'])
    df = pd.concat([df, macd], axis=1)
    
    # Calculate Bollinger Bands
    bbands = ta.bbands(df['Close'])
    df = pd.concat([df, bbands], axis=1)
    
    # Calculate EMA
    df['ema_20'] = ta.ema(df['Close'], length=20)
    df['ema_50'] = ta.ema(df['Close'], length=50)
    
    # Calculate ATR
    df['atr'] = ta.atr(df['High'], df['Low'], df['Close'])
    
    # Check for NaN values and handle them
    df.fillna(0, inplace=True)
    
    return df
```

## Data Fetching Patterns

### Get Universe of Stocks

```python
def get_stock_universe():
    """Fetch list of active stocks from Alpaca"""
    try:
        assets_url = f"{BASE_URL}/v2/assets"
        params = {
            'status': 'active',
            'asset_class': 'us_equity',
            'exchange': 'NASDAQ,NYSE'
        }
        
        response = requests.get(assets_url, headers=headers, params=params)
        
        if response.status_code == 200:
            assets = response.json()
            # Filter for tradable stocks with reasonable criteria
            symbols = [
                asset['symbol'] for asset in assets 
                if asset['tradable'] and asset['fractionable']
            ]
            return symbols[:100]  # Limit for performance
        else:
            print(f"Failed to fetch assets: {response.status_code}")
            return []
            
    except Exception as e:
        print(f"Error fetching stock universe: {e}")
        return []
```

### Get Historical Data

```python
def get_historical_data(symbol, days=30):
    """Fetch historical data for a symbol"""
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        params = {
            'symbols': symbol,
            'timeframe': '1Day',
            'start': start_date.strftime('%Y-%m-%d'),
            'end': end_date.strftime('%Y-%m-%d')
        }
        
        bars_url = f"{DATA_URL}/v2/stocks/bars"
        response = requests.get(bars_url, headers=headers, params=params)
        
        if response.status_code == 200:
            data = response.json()
            if symbol in data.get('bars', {}):
                bars = data['bars'][symbol]
                df = pd.DataFrame(bars)
                df['timestamp'] = pd.to_datetime(df['timestamp'])
                df.set_index('timestamp', inplace=True)
                df.columns = ['Open', 'High', 'Low', 'Close', 'Volume', 'TradeCount', 'VWAP']
                return df[['Open', 'High', 'Low', 'Close', 'Volume']]
        
        return None
        
    except Exception as e:
        print(f"Error fetching data for {symbol}: {e}")
        return None
```

## Error Handling

Always implement comprehensive error handling:

```python
def safe_screen_stocks(data_dict):
    try:
        return screen_stocks(data_dict)
    except Exception as e:
        error_result = {
            'matches': [],
            'details': {},
            'errors': [f"Screener execution failed: {str(e)}"]
        }
        return format_results([])
```

## Testing Your Screener

Before deploying, test your screener with:

1. **Mock data**: Ensure it handles various market conditions
2. **API connectivity**: Verify it works with real Alpaca API calls
3. **Edge cases**: Test with missing data, API failures, etc.
4. **Performance**: Ensure it completes within reasonable time limits

## Common Patterns

### RSI Oversold Screener

```python
def screen_stocks(data_dict):
    matches = []
    
    for symbol, df in data_dict.items():
        # Calculate RSI
        df['rsi'] = ta.rsi(df['Close'], length=14)
        latest_rsi = df['rsi'].iloc[-1]
        
        # Check if oversold
        if latest_rsi < 30:
            matches.append({
                'symbol': symbol,
                'score': 100 - latest_rsi,  # Lower RSI = Higher score
                'recommendation': 'BUY',
                'details': {'rsi': latest_rsi},
                'price': df['Close'].iloc[-1]
            })
    
    return format_results(matches)
```

### Breakout Detection

```python
def screen_stocks(data_dict):
    matches = []
    
    for symbol, df in data_dict.items():
        # Calculate Bollinger Bands
        bbands = ta.bbands(df['Close'])
        df = pd.concat([df, bbands], axis=1)
        
        latest_close = df['Close'].iloc[-1]
        upper_band = df['BBU_20_2.0'].iloc[-1]
        
        # Check for breakout above upper band
        if latest_close > upper_band:
            matches.append({
                'symbol': symbol,
                'score': 85,
                'recommendation': 'BUY',
                'pattern': 'Bollinger Band Breakout',
                'details': {
                    'close': latest_close,
                    'upper_band': upper_band,
                    'breakout_percentage': ((latest_close - upper_band) / upper_band) * 100
                }
            })
    
    return format_results(matches)
```

This guide provides the foundation for creating effective, reliable stock screeners that integrate seamlessly with our trading platform.