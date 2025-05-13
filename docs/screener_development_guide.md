# Stock Screener Development Guide

## Overview

This guide outlines how to develop custom stock screeners that are compatible with our platform. These screeners use Python to analyze market data and identify stocks that meet specific criteria.

## Screener Structure Requirements

Our platform requires a specific structure for screeners to function properly:

### 1. Entry Point Function

Every screener **must** have a `screen_stocks` function that serves as the main entry point:

```python
def screen_stocks(data_dict, parameters=None):
    """
    Main entry point for the screener
    
    Args:
        data_dict: Dictionary of pandas DataFrames with OHLCV data, keyed by symbol
        parameters: Optional dictionary of parameters to customize the screener
    
    Returns:
        list: List of dictionaries with screening results
    """
    # Implementation goes here
    results = []
    
    # Return the results enclosed in special markers
    # These markers are critical for the platform to extract the results
    return format_results(results)
```

### 2. Output Format

Screener results must be properly formatted with special markers:

```python
def format_results(results):
    """Format the results with the required markers"""
    import json
    
    json_str = json.dumps(results)
    
    # These markers are REQUIRED - they allow the platform to extract the results
    return f"RESULT_JSON_START\n{json_str}\nRESULT_JSON_END"
```

### 3. Result Structure

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

## Input Data Format

The `screen_stocks` function receives data in the following format:

```python
{
    "AAPL": pd.DataFrame({
        "Open": [...],
        "High": [...],
        "Low": [...], 
        "Close": [...],
        "Volume": [...]
    }),
    "MSFT": pd.DataFrame({...}),
    # Additional stocks...
}
```

Each DataFrame has:
- A DatetimeIndex for dates
- OHLCV columns (Open, High, Low, Close, Volume)
- Typically 100-250 bars of data (configurable)

## Technical Indicators

Use `pandas_ta` for technical indicators:

```python
import pandas as pd
import pandas_ta as ta
import numpy as np

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

## Complete Example Screener

Here's a complete RSI oversold screener example:

```python
import pandas as pd
import numpy as np
import pandas_ta as ta
import json
from datetime import datetime
import sys

def screen_stocks(data_dict, parameters=None):
    """
    Screen for stocks with oversold RSI values
    
    Args:
        data_dict: Dictionary of pandas DataFrames with OHLCV data
        parameters: Optional parameters dictionary
    
    Returns:
        str: JSON results with required markers
    """
    # Set default parameters if not provided
    if parameters is None:
        parameters = {}
    
    # Get parameters with defaults
    rsi_length = parameters.get('rsi_length', 14)
    rsi_threshold = parameters.get('rsi_threshold', 30)
    min_volume = parameters.get('min_volume', 500000)
    min_price = parameters.get('min_price', 5.0)
    
    results = []
    
    # Process each symbol
    for symbol, df in data_dict.items():
        try:
            # Skip if not enough data
            if len(df) < rsi_length + 5:
                continue
            
            # Get the latest data
            latest = df.iloc[-1]
            
            # Skip low priced stocks
            if latest['Close'] < min_price:
                continue
                
            # Skip low volume stocks
            avg_volume = df['Volume'].tail(20).mean()
            if avg_volume < min_volume:
                continue
            
            # Calculate RSI
            df['rsi'] = ta.rsi(df['Close'], length=rsi_length)
            
            # Calculate MACD for additional context
            macd = ta.macd(df['Close'])
            df = pd.concat([df, macd], axis=1)
            
            # Rename MACD columns for easier access
            df.rename(columns={
                f'MACD_12_26_9': 'macd',
                f'MACDs_12_26_9': 'macd_signal',
                f'MACDh_12_26_9': 'macd_hist'
            }, inplace=True)
            
            # Get latest values
            latest_rsi = df['rsi'].iloc[-1]
            latest_macd = df['macd'].iloc[-1]
            latest_macd_signal = df['macd_signal'].iloc[-1]
            latest_macd_hist = df['macd_hist'].iloc[-1]
            
            # Check if RSI is below threshold (oversold)
            if latest_rsi < rsi_threshold:
                # Calculate a score (0-100) based on how oversold
                # Lower RSI = higher score
                score = max(0, min(100, 100 - (latest_rsi * 100 / rsi_threshold)))
                
                # Adjust score based on MACD trend
                if latest_macd > latest_macd_signal:
                    score += 10  # Bullish MACD crossover adds to score
                
                # Determine strength of signal
                if score >= 80:
                    strength = "STRONG"
                elif score >= 60:
                    strength = "MODERATE"
                else:
                    strength = "WEAK"
                
                # Create result
                result = {
                    "symbol": symbol,
                    "score": round(score, 1),
                    "recommendation": "BUY",
                    "details": {
                        "rsi": round(latest_rsi, 2),
                        "macd": round(latest_macd, 4),
                        "macd_signal": round(latest_macd_signal, 4),
                        "macd_hist": round(latest_macd_hist, 4),
                        "volume": int(latest['Volume']),
                        "avg_volume_20d": int(avg_volume)
                    },
                    "price": round(latest['Close'], 2),
                    "date": df.index[-1].isoformat(),
                    "strength": strength,
                    "pattern": "RSI Oversold",
                    "timeframe": "daily"
                }
                
                # Calculate suggested stop loss (lowest low of last 5 days)
                stop_loss = df['Low'].tail(5).min() * 0.98  # 2% below recent low
                result["stop_loss"] = round(stop_loss, 2)
                
                # Add to results
                results.append(result)
                
        except Exception as e:
            # Log the error but continue processing other symbols
            print(f"Error processing {symbol}: {str(e)}", file=sys.stderr)
            continue
    
    # Sort results by score (highest first)
    results = sorted(results, key=lambda x: x['score'], reverse=True)
    
    # Limit to top 50 results
    results = results[:50]
    
    # Format and return results with required markers
    return format_results(results)

def format_results(results):
    """Format the results with the required markers"""
    json_str = json.dumps(results)
    
    # These markers are REQUIRED for the platform to extract the results
    return f"RESULT_JSON_START\n{json_str}\nRESULT_JSON_END"

# Ensure output is flushed immediately (important for the platform)
if __name__ == "__main__":
    # The platform will handle providing data_dict when calling this script
    import sys
    sys.stdout.reconfigure(line_buffering=True)
```

## Critical Requirements

For your screener to work with our platform, follow these critical rules:

1. **Use the Required Markers**: 
   - Your screener MUST output the results within `RESULT_JSON_START` and `RESULT_JSON_END` markers.
   - This allows the platform to extract the JSON results from the Python output.

2. **Flush Output**:
   - Use `sys.stdout.flush()` after printing the markers.
   - Python's output buffering can cause issues if the output isn't flushed.
   - Alternatively, use `sys.stdout.reconfigure(line_buffering=True)` in Python 3.7+.

3. **Handle Errors Gracefully**:
   - Catch and handle exceptions to prevent the screener from crashing.
   - Log errors to `sys.stderr` but continue processing other symbols.

4. **Validate Input Data**:
   - Check for sufficient data and handle missing values.
   - Skip symbols with insufficient data instead of failing.

5. **Respect Performance Constraints**:
   - Process data efficiently to complete within reasonable time.
   - Avoid excessive memory usage.

## Advanced Screener Techniques

### 1. Multi-Factor Screening

Combine multiple factors for more powerful screeners:

```python
def calculate_score(df):
    """Calculate a composite score based on multiple factors"""
    score = 0
    
    # RSI Factor (0-25 points)
    latest_rsi = df['rsi'].iloc[-1]
    if latest_rsi < 30:
        # Lower RSI = higher score
        score += max(0, min(25, 25 * (30 - latest_rsi) / 30))
    
    # Volume Factor (0-25 points)
    latest_volume = df['Volume'].iloc[-1]
    avg_volume = df['Volume'].iloc[-20:].mean()
    volume_ratio = latest_volume / avg_volume if avg_volume > 0 else 0
    if volume_ratio > 1.5:
        # Higher volume ratio = higher score
        score += min(25, (volume_ratio - 1) * 10)
    
    # Trend Factor (0-25 points)
    ema_20 = df['ema_20'].iloc[-1]
    ema_50 = df['ema_50'].iloc[-1]
    close = df['Close'].iloc[-1]
    if close > ema_20 and ema_20 > ema_50:
        score += 25
    elif close > ema_20:
        score += 15
    elif close > ema_50:
        score += 10
    
    # Momentum Factor (0-25 points)
    if df['macd'].iloc[-1] > df['macd_signal'].iloc[-1]:
        # MACD above signal line
        score += 15
        
        # MACD histogram increasing
        if df['macd_hist'].iloc[-1] > df['macd_hist'].iloc[-2]:
            score += 10
    
    return score
```

### 2. Pattern Recognition

Identify chart patterns:

```python
def detect_double_bottom(df, tolerance=0.02):
    """
    Detect a double bottom pattern
    
    Args:
        df: DataFrame with OHLCV data
        tolerance: Price tolerance for comparing bottoms
        
    Returns:
        bool: True if double bottom detected
    """
    # Need at least 40 bars for reliable pattern detection
    if len(df) < 40:
        return False
    
    # Get a slice of recent data (last 40 bars)
    recent = df.iloc[-40:].copy()
    
    # Find local minima
    recent['min_5'] = recent['Low'].rolling(10, center=True).min()
    
    # A point is a local minimum if the 5-day min equals its low
    recent['is_min'] = (recent['Low'] - recent['min_5']).abs() < (recent['Low'] * tolerance)
    
    # Get the indices of local minima
    min_indices = recent[recent['is_min']].index.tolist()
    
    # Need at least 2 minima
    if len(min_indices) < 2:
        return False
    
    # Check the most recent two minima
    bottom1_idx = min_indices[-2]
    bottom2_idx = min_indices[-1]
    
    # Get the values
    bottom1 = recent.loc[bottom1_idx, 'Low']
    bottom2 = recent.loc[bottom2_idx, 'Low']
    
    # Bottoms should be at similar price levels
    bottoms_equal = abs(bottom1 - bottom2) < (bottom1 * tolerance)
    
    # Bottoms should be separated by at least 10 bars
    time_gap = (recent.index.get_loc(bottom2_idx) - recent.index.get_loc(bottom1_idx)) >= 10
    
    # There should be a peak in between the bottoms
    between_idx = recent.index[recent.index.get_loc(bottom1_idx) + 5:recent.index.get_loc(bottom2_idx)]
    if len(between_idx) == 0:
        return False
        
    between_high = recent.loc[between_idx, 'High'].max()
    peak_height = between_high / max(bottom1, bottom2) - 1
    significant_peak = peak_height > 0.05  # 5% higher
    
    # Price should be moving up from the second bottom
    recent_close = recent['Close'].iloc[-1]
    recovery = recent_close > bottom2 * 1.02  # 2% above bottom
    
    return bottoms_equal and time_gap and significant_peak and recovery
```

### The SCTR Stock Ranking System

The SCTR (Stock Composite Technical Rank) is a ranking system that grades stocks based on six technical indicators across three timeframes:

```python
def calculate_sctr(df):
    """
    Calculate SCTR (Stock Composite Technical Rank)
    
    SCTR consists of:
    - Long-Term Indicators (60%):
      * Percent above/below 200-day EMA (30%)
      * 125-day Rate of Change (30%)
    - Medium-Term Indicators (30%):
      * Percent above/below 50-day EMA (15%)
      * 20-day Rate of Change (15%)
    - Short-Term Indicators (10%):
      * 3-day slope of PPO histogram (5%)
      * 14-day RSI (5%)
    """
    # Make a copy of the dataframe
    df = df.copy()
    
    # Calculate EMAs
    df['ema_50'] = ta.ema(df['Close'], length=50)
    df['ema_200'] = ta.ema(df['Close'], length=200)
    
    # Get the latest close
    latest_close = df['Close'].iloc[-1]
    
    # Calculate percent from EMAs
    pct_ema_50 = (latest_close / df['ema_50'].iloc[-1] - 1) * 100
    pct_ema_200 = (latest_close / df['ema_200'].iloc[-1] - 1) * 100
    
    # Calculate rate of change
    df['roc_20'] = ta.roc(df['Close'], length=20)
    df['roc_125'] = ta.roc(df['Close'], length=125)
    
    # Calculate PPO (Percentage Price Oscillator)
    df['ppo'] = ta.ppo(df['Close'])['PPO_12_26_9']
    
    # Calculate 3-day slope of PPO
    if len(df) >= 3:
        ppo_values = df['ppo'].iloc[-3:].values
        ppo_slope = np.polyfit(range(3), ppo_values, 1)[0]
    else:
        ppo_slope = 0
    
    # Calculate RSI
    df['rsi'] = ta.rsi(df['Close'], length=14)
    
    # Get latest values
    latest_roc_20 = df['roc_20'].iloc[-1]
    latest_roc_125 = df['roc_125'].iloc[-1]
    latest_rsi = df['rsi'].iloc[-1]
    
    # Normalize values to 0-100 scale
    # These ranges are approximations and may need adjustment
    norm_pct_ema_50 = normalize_value(pct_ema_50, -10, 10)
    norm_pct_ema_200 = normalize_value(pct_ema_200, -20, 20)
    norm_roc_20 = normalize_value(latest_roc_20, -15, 15)
    norm_roc_125 = normalize_value(latest_roc_125, -30, 30)
    norm_ppo_slope = normalize_value(ppo_slope, -0.5, 0.5)
    norm_rsi = latest_rsi  # RSI already on 0-100 scale
    
    # Calculate SCTR with weightings
    sctr = (
        (norm_pct_ema_200 * 0.3) +  # 30% weight
        (norm_roc_125 * 0.3) +      # 30% weight
        (norm_pct_ema_50 * 0.15) +  # 15% weight
        (norm_roc_20 * 0.15) +      # 15% weight
        (norm_ppo_slope * 0.05) +   # 5% weight
        (norm_rsi * 0.05)           # 5% weight
    )
    
    return max(0, min(100, sctr))  # Ensure value is between 0-100

def normalize_value(value, min_val, max_val):
    """Normalize a value to 0-100 scale"""
    # Adjust value to be within range
    value = max(min_val, min(max_val, value))
    
    # Normalize to 0-100
    return ((value - min_val) / (max_val - min_val)) * 100
```

## Best Practices

1. **Efficient Calculations**:
   - Use vectorized operations (numpy/pandas) instead of loops.
   - Pre-calculate indicators once per symbol.

2. **Clear Documentation**:
   - Document the purpose and logic of your screener.
   - Explain the parameters and their impact.

3. **Parameterization**:
   - Make key thresholds configurable parameters.
   - Provide reasonable defaults.

4. **Error Handling**:
   - Handle edge cases like insufficient data.
   - Catch and log exceptions.

5. **Output Quality**:
   - Include detailed information in results.
   - Sort results by relevance (score).

6. **Testing**:
   - Test with a diverse set of symbols.
   - Verify edge cases and boundary conditions.

## Common Errors and Solutions

### 1. Missing or Invalid Output Format

**Error**: Platform cannot parse screener results

**Solution**:
- Ensure you're using the exact markers: `RESULT_JSON_START` and `RESULT_JSON_END`
- Verify your JSON is valid (no syntax errors)
- Check that `sys.stdout.flush()` is called after printing results

### 2. Performance Issues

**Error**: Screener times out or uses excessive memory

**Solution**:
- Optimize calculations (use vectorized operations)
- Limit the depth of data processing
- Consider processing only a subset of symbols if performance is critical

### 3. Data Handling Errors

**Error**: KeyError or NaN errors in calculations

**Solution**:
- Always check if required data exists before calculations
- Handle missing values appropriately (fillna or skip)
- Verify index alignment when joining DataFrames

## Conclusion

Following this guide will help you create effective stock screeners that seamlessly integrate with our platform. The key is to adhere to the required structure and output format while implementing your custom screening logic.

For any questions or additional support, refer to our support documentation or contact our development team.