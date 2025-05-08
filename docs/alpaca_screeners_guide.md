# Alpaca-Powered Stock Screeners

This guide explains how to use the Alpaca API-powered stock screeners for more reliable data access.

## Why Use Alpaca Instead of YFinance?

1. **API Stability**: Alpaca provides an officially supported API with consistent endpoints and proper rate limiting
2. **Data Reliability**: Alpaca Market Data API delivers consistent, reliable financial data for both real-time and historical analysis
3. **Authentication**: Your system already has Alpaca API credentials, making it easy to authenticate and use
4. **Execution Environment**: The Alpaca API has been tested and works reliably in the platform's execution environment

## Available Screeners

### 1. Alpaca SCTR Screener (`alpaca_sctr_screener.py`)

This screener implements the StockCharts Technical Rank (SCTR) methodology using Alpaca data. It analyzes stocks based on:

- **Long-term components (30%)**
  - 200-day EMA percentage
  - 125-day rate of change

- **Medium-term components (30%)**
  - 50-day EMA percentage
  - 20-day rate of change

- **Short-term components (40%)**
  - 14-day RSI
  - 3-day RSI slope
  - 6-day rate of change
  - Volume trend

The final SCTR score is a weighted combination of these factors, producing a 0-100 rating that ranks stocks by technical strength.

### 2. Alpaca Breakout Screener (`alpaca_breakout_screener.py`)

This screener identifies stocks showing potential bullish breakout patterns by analyzing:

- Price above minimum threshold
- Volume above minimum threshold
- RSI in bullish territory (above 55)
- Volume spike relative to 20-day average
- Price above key moving averages (20-day and 50-day)

Stocks receive a breakout score based on how many criteria they meet, with those scoring above 60 considered potential breakout candidates.

## How to Use These Screeners

1. Create a new screener in the platform using the code from one of the example files
2. Run the screener - it will automatically use the Alpaca API credentials from your environment
3. View results showing only actual matches found using real market data - no fallbacks or synthetic data is used

## Data Quality Notes

- These screeners process a limited set of tickers to ensure they complete within the execution time constraints
- All calculations are performed using real market data from Alpaca
- If real data isn't available for any reason, the ticker is skipped (no fallbacks are used)
- The screeners include detailed print statements for debugging purposes

## Customization

You can customize these screeners by modifying:

- The list of tickers to screen
- The configuration parameters (thresholds for price, volume, RSI, etc.)
- The scoring weights for different components
- The time periods for various indicators (moving averages, ROC periods, etc.)

## Example

```python
# To modify the SCTR threshold in the Alpaca SCTR Screener:
params = {
    "sctr_threshold": 75,  # Increased from default 65
    "min_price": 20,
    "min_volume": 500000
}
```

## Error Handling

The screeners include comprehensive error handling to ensure they complete successfully:

- If Alpaca API credentials aren't found, an empty result is returned
- If any ticker can't be processed, it's skipped and the screener continues
- Detailed logging helps identify which tickers might be problematic