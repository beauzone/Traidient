# Troubleshooting Stock Screeners

This guide addresses common issues with stock screeners, specifically focusing on problems with synthetic "fallback" data and how to ensure your screeners use only real market data.

## The Problem with YFinance

The Yahoo Finance API (accessed via the `yfinance` library) is not an official or supported API. It was created by scraping Yahoo Finance's website data, which makes it:

1. Unreliable and subject to breaking when Yahoo changes their website
2. Limited in the data it can access reliably
3. Often slow or prone to timeouts
4. Not suitable for production-level financial applications

These limitations often lead to issues where the screener cannot get real data and falls back to using synthetic placeholder data, which is undesirable.

## Using Alpaca Market Data API

We've created several screeners that use Alpaca's official Market Data API instead of YFinance:

### 1. Direct API Calls Approach (`alpaca_direct_calls_screener.py`)

This approach makes direct HTTP requests to Alpaca's REST API endpoints:

```python
# Example of direct API calls
bars_endpoint = f"{DATA_URL}/v2/stocks/{ticker}/bars"
bars_params = {
    'timeframe': '1Day',
    'start': start_date,
    'end': end_date,
    'adjustment': 'raw'
}
bars_response = requests.get(bars_endpoint, headers=headers, params=bars_params)
```

**Advantages:**
- Simple and easy to understand
- No dependency on SDK libraries
- More control over request details

### 2. Alpaca SDK Approach (`alpaca_sdk_screener.py`)

This approach uses Alpaca's official Python SDK:

```python
# Example of SDK usage
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame

client = StockHistoricalDataClient(API_KEY, API_SECRET)
bars_request = StockBarsRequest(
    symbol_or_symbols=tickers,
    timeframe=TimeFrame.Day,
    start=start_date,
    end=end_date
)
bars_response = client.get_stock_bars(bars_request)
```

**Advantages:**
- Cleaner, more abstracted code
- Built-in error handling and type validation
- Better maintenance and updates from Alpaca

## Debugging Tips

If you're still seeing issues with your screeners:

1. **Check API Credentials**: Make sure your `ALPACA_API_KEY` and `ALPACA_API_SECRET` environment variables are set correctly.

2. **Verify API Access**: Try a simple API call to see if you can access the Alpaca API:
   ```python
   account_endpoint = f"{BASE_URL}/v2/account"
   account_response = requests.get(account_endpoint, headers=headers)
   print(account_response.status_code, account_response.text)
   ```

3. **Reduce the Data Load**: Request data for fewer tickers and shorter time periods to reduce the chances of timeouts.

4. **Add Extensive Logging**: Print detailed logs at each step to identify where failures occur.

5. **Check Rate Limits**: Alpaca has rate limits that may be affecting your requests if you're making too many in quick succession.

## Key Takeaways

1. **Use Alpaca Instead of YFinance**: Alpaca provides a reliable, official API with stable endpoints.

2. **Direct API Calls vs SDK**: Choose based on your needs - direct calls for simplicity, SDK for cleaner code and better abstraction.

3. **Return Empty Results Instead of Fallbacks**: If real data cannot be obtained, it's better to return empty results than to use synthetic data.

4. **Robust Error Handling**: Always implement comprehensive error handling and logging to diagnose issues.

## Next Steps

1. Try the examples in `alpaca_direct_calls_screener.py` or `alpaca_sdk_screener.py`
2. Review the detailed documentation in `alpaca_screeners_guide.md` and `alpaca_sdk_guide.md`
3. Implement proper error handling in your own screeners