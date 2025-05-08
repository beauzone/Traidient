# Using the Alpaca SDK for Reliable Stock Screening

This guide provides instructions for using the official Alpaca SDK (`alpaca-py`) to create reliable stock screeners that use authentic market data.

## Why Use the Alpaca SDK Instead of YFinance?

1. **Official Support**: The `alpaca-py` SDK is an officially supported client library, maintained by Alpaca
2. **Reliability**: It provides consistent, stable access to market data without the reliability issues of unofficial libraries
3. **Feature-Rich**: Includes support for both historical and real-time data with proper error handling
4. **Performance**: Optimized for efficient data retrieval and processing
5. **Authentication**: Seamlessly handles API authentication with your existing Alpaca credentials

## Setup and Installation

The Alpaca SDK is already installed in our environment. To use it in your screeners:

1. Import the necessary components:
```python
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest, StockQuotesRequest
from alpaca.data.timeframe import TimeFrame
```

2. Initialize the client with your API credentials:
```python
# These are automatically loaded from environment variables
API_KEY = os.environ.get('ALPACA_API_KEY')
API_SECRET = os.environ.get('ALPACA_API_SECRET')

# Create the client
client = StockHistoricalDataClient(API_KEY, API_SECRET)
```

## Retrieving Market Data

The SDK provides convenient methods to retrieve various types of market data:

### Getting Historical Bars (OHLC + Volume data)

```python
# Define request parameters
bars_request = StockBarsRequest(
    symbol_or_symbols=["AAPL", "MSFT", "GOOGL"],  # Multiple symbols at once
    timeframe=TimeFrame.Day,  # Daily bars
    start=datetime(2023, 1, 1),
    end=datetime.now()
)

# Get the data
bars = client.get_stock_bars(bars_request)

# Convert to pandas DataFrame for analysis
bars_df = bars.df
```

### Getting Latest Quotes

```python
# Define request parameters
quotes_request = StockQuotesRequest(
    symbol_or_symbols=["AAPL", "MSFT", "GOOGL"],
    start=datetime.now() - timedelta(minutes=15),
    end=datetime.now()
)

# Get the data
quotes = client.get_stock_quotes(quotes_request)
```

## Working with the Data

Once you have the market data, you can perform technical analysis:

```python
# Calculate a simple moving average
bars_df['sma_20'] = bars_df['close'].rolling(window=20).mean()

# Calculate RSI
delta = bars_df['close'].diff()
gain = delta.clip(lower=0).rolling(window=14).mean()
loss = -delta.clip(upper=0).rolling(window=14).mean()
rs = gain / loss
bars_df['rsi_14'] = 100 - (100 / (1 + rs))
```

## Example Screener Template

See `docs/examples/alpaca_sdk_screener.py` for a complete example of a screener that:

1. Uses the Alpaca SDK to retrieve real market data
2. Calculates technical indicators
3. Scores stocks based on trend strength, RSI, and volume patterns
4. Returns only real matches (no fallbacks)

## Optimization Tips

1. **Batch Requests**: Request data for multiple symbols in a single API call to reduce API usage
2. **Error Handling**: Implement proper error handling to ensure your screener completes even if some symbols fail
3. **Data Caching**: For longer timeframes, consider caching historical data to avoid repeated API calls
4. **Logging**: Include detailed logging to help diagnose any issues

## Reference Documentation

For complete SDK documentation, visit:
- [Alpaca API Documentation](https://docs.alpaca.markets/docs/getting-started-with-alpaca-market-data)
- [alpaca-py GitHub Repository](https://github.com/alpacahq/alpaca-py)

Remember that all screeners using the Alpaca SDK will only return real, authentic market data without any synthetic fallbacks, ensuring the highest data integrity for your trading strategies.