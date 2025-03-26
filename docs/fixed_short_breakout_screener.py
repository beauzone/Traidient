def screen_short_breakout(df):
    """
    Identifies stocks with short breakout potential based on:
    - Price below 20-day low (support break)
    - Strong trend (ADX > 20)
    - Oversold condition (RSI < 40)
    - Volume spike (Volume > 1.3 * 20-day average volume)
    
    Parameters:
    df: MultiIndex DataFrame with ['ticker', 'date'] index.
    Columns required: ['close', 'low_20', 'adx', 'rsi', 'volume', 'volume_avg_20']
    
    Returns:
    DataFrame with filtered stocks showing breakout potential, including ticker symbols.
    """
    import pandas as pd

    # Verify required columns exist
    required_columns = ['close', 'low_20', 'adx', 'rsi', 'volume', 'volume_avg_20']
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns: {missing_columns}")

    # Get latest data point for each ticker
    latest_data = df.groupby("ticker").tail(1).copy()
    
    # Conditions
    condition_1 = latest_data["close"] < latest_data["low_20"]  # Support break
    condition_2 = latest_data["adx"] > 20                       # Strong trend
    condition_3 = latest_data["rsi"] < 40                       # Oversold
    condition_4 = latest_data["volume"] > 1.3 * latest_data["volume_avg_20"]  # Volume spike

    filtered = latest_data[condition_1 & condition_2 & condition_3 & condition_4].copy()
    
    # If no matches found, return empty DataFrame with correct columns
    if len(filtered) == 0:
        return pd.DataFrame(columns=['ticker', 'close', 'low_20', 'adx', 'rsi', 'volume', 'volume_avg_20', 'score'])
    
    # Ranking - higher score = better match
    filtered["score"] = (40 - filtered["rsi"]) + \
                        (filtered["adx"] - 20) + \
                        ((filtered["volume"] / filtered["volume_avg_20"]) - 1) * 10
    
    # Reset index to get ticker as a column
    filtered = filtered.reset_index(level=0)
    
    return filtered.sort_values("score", ascending=False)[
        ["ticker", "close", "low_20", "adx", "rsi", "volume", "volume_avg_20", "score"]
    ]