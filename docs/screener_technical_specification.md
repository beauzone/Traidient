# Stock Screener Technical Specification

## Overview

This document outlines the technical specifications for creating stock screeners compatible with our trading platform. It defines the input and output formats, required structure, and best practices for developing effective stock screening algorithms.

## 1. Input Data Format

### 1.1 DataFrame Structure

All screener functions receive a pandas DataFrame with the following structure:

- **Index**: MultiIndex with levels ['ticker', 'date']
- **Timeframe**: Typically daily data (1d), but can also be hourly, weekly, etc.
- **Date Range**: Usually 3-12 months of historical data, depending on the strategy

Example of input DataFrame structure:
```python
# MultiIndex DataFrame with (ticker, date) as index
#                   open    high     low   close   volume    ... other columns
# ticker  date
# AAPL    2025-01-01  181.5   182.7   180.3   182.1  28456123    ...
#         2025-01-02  183.1   184.9   182.5   184.3  31567234    ...
# MSFT    2025-01-01  372.8   374.3   370.1   373.5  12345678    ...
#         2025-01-02  374.2   375.8   373.0   375.2  14567890    ...
```

### 1.2 Available Columns

Screener functions can expect the following columns in the input DataFrame:

#### Price Data (Always Available)
- `open`: Opening price
- `high`: High price
- `low`: Low price
- `close`: Closing price
- `volume`: Trading volume

#### Common Technical Indicators (Pre-calculated)
- `sma_XX`: Simple Moving Average (XX periods)
- `ema_XX`: Exponential Moving Average (XX periods)
- `rsi`: Relative Strength Index (14 periods by default)
- `macd`: MACD Line
- `macd_signal`: MACD Signal Line
- `macd_hist`: MACD Histogram
- `bbands_upper`: Bollinger Bands Upper Band
- `bbands_middle`: Bollinger Bands Middle Band
- `bbands_lower`: Bollinger Bands Lower Band
- `atr`: Average True Range
- `adx`: Average Directional Index
- `plus_di`: Plus Directional Indicator
- `minus_di`: Minus Directional Indicator
- `volume_avg_XX`: Volume Moving Average (XX periods)

#### Calculated Price Levels
- `high_XX`: Highest high in the last XX periods
- `low_XX`: Lowest low in the last XX periods
- `close_prev`: Previous closing price
- `close_change_pct`: Percentage change from previous close

## 2. Output Requirements

### 2.1 Return Format

Screener functions must return a pandas DataFrame with the following characteristics:

- Must include the `ticker` column in the returned results
- Should return a filtered subset of the original DataFrame
- Should include original price data and indicators used for filtering
- May include additional calculated columns for user information
- Should include a `score` column if ranking results

### 2.2 Standard Return Columns

At minimum, screeners should return the following columns:

```python
return filtered_data[["ticker", "close", ... other relevant columns ..., "score"]]
```

### 2.3 Empty Results Handling

When no stocks match the screening criteria, return an empty DataFrame with the correct column structure:

```python
if len(filtered) == 0:
    return pd.DataFrame(columns=["ticker", "close", ... other relevant columns ..., "score"])
```

### 2.4 Scoring Mechanism

If implementing a scoring mechanism:

- Higher scores should indicate stronger matches to the criteria
- Score calculations should be explained in comments or docstring
- Scores should be normalized to a reasonable range (typically 0-100 or 0-10)

## 3. Function Structure

### 3.1 Standard Function Signature

```python
def screen_strategy_name(df, param1=default1, param2=default2, ...):
    """
    Brief description of the screening strategy.
    
    Parameters:
    df: MultiIndex DataFrame with ['ticker', 'date'] index.
    param1: Description of first parameter.
    param2: Description of second parameter.
    ...
    
    Returns:
    DataFrame with filtered stocks and additional calculated metrics.
    """
    # Implementation
    ...
```

### 3.2 Required Documentation

All screener functions must include:

- Purpose and strategy description
- Required input columns
- Parameters with default values and descriptions
- Description of the filtering criteria
- Description of the scoring algorithm (if applicable)
- Return value description

### 3.3 Error Handling

Implement the following error handling:

- Verify that required columns exist in the input DataFrame
- Handle edge cases (empty DataFrames, missing data, etc.)
- Use sensible defaults for parameters
- Include informative error messages

Example:
```python
# Verify required columns exist
required_columns = ['close', 'volume', 'rsi', 'sma_50']
missing_columns = [col for col in required_columns if col not in df.columns]
if missing_columns:
    raise ValueError(f"Missing required columns: {missing_columns}")
```

### 3.4 Performance Considerations

- Filter data early to reduce the size of the working dataset
- Use vectorized operations when possible (avoid loops)
- Minimize the creation of temporary DataFrames
- Consider computational complexity for large stock universes

## 4. Example Implementations

### 4.1 Simple Moving Average Crossover Screen

```python
def screen_sma_crossover(df, fast_period=20, slow_period=50):
    """
    Screens for stocks where the fast moving average has crossed above
    the slow moving average, indicating potential upward momentum.
    
    Parameters:
    df: MultiIndex DataFrame with ['ticker', 'date'] index.
    fast_period: Period for the fast moving average (default: 20)
    slow_period: Period for the slow moving average (default: 50)
    
    Returns:
    DataFrame with stocks that have a recent moving average crossover.
    """
    # Verify required columns
    required_columns = ['close']
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns: {missing_columns}")
    
    # Calculate moving averages if not already present
    if f'sma_{fast_period}' not in df.columns:
        df[f'sma_{fast_period}'] = df.groupby('ticker')['close'].transform(
            lambda x: x.rolling(fast_period).mean())
    
    if f'sma_{slow_period}' not in df.columns:
        df[f'sma_{slow_period}'] = df.groupby('ticker')['close'].transform(
            lambda x: x.rolling(slow_period).mean())
    
    # Get the latest two data points for each ticker
    latest_data = df.groupby('ticker').tail(2)
    
    # Create separate DataFrames for current and previous data points
    current_data = latest_data.groupby('ticker').tail(1)
    previous_data = latest_data.groupby('ticker').head(1)
    
    # Set conditions for crossover
    current_cross_over = current_data[f'sma_{fast_period}'] > current_data[f'sma_{slow_period}']
    previous_cross_under = previous_data[f'sma_{fast_period}'] <= previous_data[f'sma_{slow_period}']
    
    # Filter tickers that match the crossover pattern
    crossover_tickers = current_data[current_cross_over].index.get_level_values('ticker')
    cross_under_tickers = previous_data[previous_cross_under].index.get_level_values('ticker')
    
    # Find tickers that satisfy both conditions
    valid_tickers = set(crossover_tickers) & set(cross_under_tickers)
    
    # Filter the results
    filtered = current_data[current_data.index.get_level_values('ticker').isin(valid_tickers)].copy()
    
    if len(filtered) == 0:
        return pd.DataFrame(columns=['ticker', 'close', f'sma_{fast_period}', 
                                     f'sma_{slow_period}', 'crossover_strength', 'score'])
    
    # Calculate additional metrics
    filtered['crossover_strength'] = (filtered[f'sma_{fast_period}'] / filtered[f'sma_{slow_period}'] - 1) * 100
    
    # Add score based on crossover strength and close position relative to moving averages
    filtered['score'] = filtered['crossover_strength'] + (filtered['close'] / filtered[f'sma_{fast_period}'] - 1) * 50
    
    # Reset index to get ticker as a column
    filtered = filtered.reset_index(level=0)
    
    # Return the results with the most relevant columns
    return filtered.sort_values('score', ascending=False)[
        ['ticker', 'close', f'sma_{fast_period}', f'sma_{slow_period}', 'crossover_strength', 'score']
    ]
```

### 4.2 Momentum Screen Example

```python
def screen_momentum(df, rsi_threshold=60, volume_factor=1.5, price_change_days=5):
    """
    Screens for stocks showing strong momentum based on:
    - RSI above threshold
    - Volume above average
    - Price increasing over the specified period
    
    Parameters:
    df: MultiIndex DataFrame with ['ticker', 'date'] index.
    rsi_threshold: Minimum RSI value (default: 60)
    volume_factor: Minimum volume relative to average (default: 1.5)
    price_change_days: Number of days to measure price change (default: 5)
    
    Returns:
    DataFrame with stocks showing momentum characteristics.
    """
    # Get the latest data for each ticker
    latest_data = df.groupby('ticker').tail(1).copy()
    
    # Calculate price change over specified number of days if not already present
    if 'price_change_pct' not in latest_data.columns:
        # Get data from price_change_days ago
        past_data = df.groupby('ticker').nth(-price_change_days)
        # Calculate the percentage change
        price_changes = {}
        for ticker in latest_data.index.get_level_values('ticker').unique():
            if ticker in past_data.index.get_level_values('ticker'):
                current_price = latest_data.loc[(ticker,), 'close'].iloc[0]
                past_price = past_data.loc[(ticker,), 'close'].iloc[0]
                price_changes[ticker] = ((current_price / past_price) - 1) * 100
        
        # Add the price change to the latest data
        for ticker, change in price_changes.items():
            latest_data.loc[(ticker,), 'price_change_pct'] = change
    
    # Apply conditions
    condition_1 = latest_data['rsi'] > rsi_threshold
    condition_2 = latest_data['volume'] > latest_data['volume_avg_20'] * volume_factor
    condition_3 = latest_data['price_change_pct'] > 0
    
    # Filter the data
    filtered = latest_data[condition_1 & condition_2 & condition_3].copy()
    
    # Handle empty results
    if len(filtered) == 0:
        return pd.DataFrame(columns=['ticker', 'close', 'rsi', 'volume', 
                                    'volume_avg_20', 'price_change_pct', 'score'])
    
    # Calculate score based on multiple factors
    filtered['score'] = (
        (filtered['rsi'] - rsi_threshold) * 0.5 +
        (filtered['volume'] / filtered['volume_avg_20'] - 1) * 20 +
        filtered['price_change_pct'] * 2
    )
    
    # Reset index to get ticker as a column
    filtered = filtered.reset_index(level=0)
    
    # Return the results
    return filtered.sort_values('score', ascending=False)[
        ['ticker', 'close', 'rsi', 'volume', 'volume_avg_20', 'price_change_pct', 'score']
    ]
```

## 5. Integration Guidelines

### 5.1 User Interface Integration

Screeners will be displayed in the UI with the following components:

- The `ticker` column is used to display the stock symbol
- The `score` column is used for sorting and highlighting top matches
- Columns with numeric values are formatted according to their type (price, percentage, etc.)
- Special columns (like technical indicators) get specific UI treatment

### 5.2 Customizable Parameters

- Parameters with default values can be exposed to users for customization
- Parameter descriptions from the docstring are used to generate UI labels
- Parameter types should match what's expected in the UI (int, float, bool, etc.)

Example of exposing parameters:
```python
def screen_example(df, min_price=10, max_price=1000, min_volume=500000):
    """
    Example screener with customizable parameters.
    
    Parameters:
    df: MultiIndex DataFrame with ['ticker', 'date'] index.
    min_price: Minimum stock price (default: 10)
    max_price: Maximum stock price (default: 1000)
    min_volume: Minimum trading volume (default: 500000)
    """
    # Implementation...
```

In the UI, this will display sliders or input fields for:
- min_price: "Minimum stock price" (default: 10)
- max_price: "Maximum stock price" (default: 1000)
- min_volume: "Minimum trading volume" (default: 500000)

### 5.3 Strategy Explanation

Each screener should provide a clear explanation of its strategy in the docstring:

```python
def screen_strategy_name(df, param1=default1):
    """
    This strategy identifies stocks that are experiencing a breakout from a consolidation period.
    It looks for:
    1. Price breaking above a recent resistance level
    2. Increase in trading volume
    3. RSI indicating strong but not overbought momentum
    
    This is often a sign of continued upward movement and can present good entry points.
    """
    # Implementation...
```

## 6. Testing and Validation

### 6.1 Validation Tests

Each screener should be tested for:

- Correct handling of the input DataFrame structure
- Proper filtering based on criteria
- Appropriate scoring of results
- Handling of edge cases (empty results, missing data)
- Computational efficiency with large datasets

### 6.2 Common Pitfalls to Avoid

- Failing to handle missing or NaN values
- Not checking for required columns
- Using loops instead of vectorized operations
- Not including the ticker in the output
- Returning incorrect DataFrame structure
- Overly complex or inefficient calculations

### 6.3 Performance Benchmarking

- Test with different universe sizes (100, 500, 5000 stocks)
- Measure execution time and memory usage
- Optimize bottlenecks in the implementation

## 7. Best Practices

### 7.1 Code Style

- Follow PEP 8 style guidelines
- Use descriptive variable names
- Include comprehensive docstrings
- Add comments for complex logic
- Use type hints where appropriate

### 7.2 Algorithm Design

- Focus on clear, interpretable conditions
- Use a balanced approach to filtering and scoring
- Avoid overfitting to historical data
- Consider market conditions in the design

### 7.3 Reusable Components

- Extract common operations into utility functions
- Standardize calculations for consistency
- Modularize complex logic into smaller, testable components

## Appendix: Technical Indicator Reference

| Indicator | Column Name | Description |
|-----------|-------------|-------------|
| Simple Moving Average | `sma_XX` | Average price over XX periods |
| Exponential Moving Average | `ema_XX` | Weighted average giving more importance to recent prices |
| Relative Strength Index | `rsi` | Momentum oscillator measuring speed and change of price movements |
| Moving Average Convergence Divergence | `macd`, `macd_signal`, `macd_hist` | Trend-following momentum indicator |
| Bollinger Bands | `bbands_upper`, `bbands_middle`, `bbands_lower` | Volatility bands placed above and below a moving average |
| Average True Range | `atr` | Market volatility indicator |
| Average Directional Index | `adx` | Measures trend strength |
| Directional Indicators | `plus_di`, `minus_di` | Measures positive and negative directional movement |
| Volume Moving Average | `volume_avg_XX` | Average volume over XX periods |