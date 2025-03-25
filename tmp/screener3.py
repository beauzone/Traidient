# Using pandas_ta for advanced technical indicators

def calculate_advanced_indicators(df):
    """Calculate advanced technical indicators using pandas_ta"""
    try:
        import pandas_ta as ta
        
        # Make a copy to avoid modifying the original
        df_copy = df.copy()
        
        # Ichimoku Cloud
        ichimoku = ta.ichimoku(df_copy["High"], df_copy["Low"], df_copy["Close"])
        df_copy = df_copy.join(ichimoku["ISA_9"])
        df_copy = df_copy.join(ichimoku["ISB_26"])
        df_copy = df_copy.join(ichimoku["ITS_9"])
        df_copy = df_copy.join(ichimoku["IKS_26"])
        df_copy = df_copy.join(ichimoku["ICS_26"])
        
        # Elder Ray Index
        elder = ta.er(df_copy["High"], df_copy["Low"], df_copy["Close"])
        df_copy = df_copy.join(elder)
        
        # Squeeze Momentum
        squeeze = ta.squeeze(df_copy["High"], df_copy["Low"], df_copy["Close"])
        df_copy = df_copy.join(squeeze)
        
        return df_copy
    except ImportError:
        print("Warning: pandas_ta not available, using basic indicators")
        return df

def screen_stocks(data_dict):
    """Screen stocks using advanced technical indicators"""
    results = {}
    matches = []
    
    for symbol, df in data_dict.items():
        if df.empty or len(df) < 50:
            continue
            
        # Add advanced indicators
        df_advanced = calculate_advanced_indicators(df)
        
        # Skip if data frame does not have our indicators
        if not all(col in df_advanced.columns for col in ["ISA_9", "ISB_26", "ICS_26"]):
            continue
        
        latest = df_advanced.iloc[-1]
        
        # Ichimoku Cloud Strategy
        price_above_cloud = latest["Close"] > latest["ISA_9"] and latest["Close"] > latest["ISB_26"]
        conversion_above_base = latest["ITS_9"] > latest["IKS_26"]
        
        # Bullish squeeze momentum (if available)
        squeeze_momentum = False
        if "SQZ_20_2.0_20_1.5_2" in df_advanced.columns and "SQZ_ON" in df_advanced.columns:
            squeeze_momentum = latest["SQZ_20_2.0_20_1.5_2"] > 0 and latest["SQZ_ON"] == 1
            
        # Check if price is in uptrend (above 50-day MA)
        price_uptrend = latest["Close"] > latest["SMA_50"]
        
        # Volume confirmation
        volume_confirming = latest["Volume"] > latest["Volume_SMA_20"]
        
        # Combine criteria - need Ichimoku cloud bullish and either momentum or uptrend
        signal_strength = 0
        if price_above_cloud: signal_strength += 1
        if conversion_above_base: signal_strength += 1
        if squeeze_momentum: signal_strength += 1
        if price_uptrend: signal_strength += 1
        if volume_confirming: signal_strength += 1
        
        if signal_strength >= 3 and price_above_cloud:  # At least 3 conditions including price above cloud
            matches.append(symbol)
            results[symbol] = {
                "close": float(latest["Close"]),
                "signal_strength": signal_strength,
                "cloud_bullish": price_above_cloud,
                "conversion_bullish": conversion_above_base,
                "squeeze_momentum": squeeze_momentum,
                "uptrend": price_uptrend,
                "volume_confirming": volume_confirming
            }
    
    return {
        "matches": matches,
        "details": results
    }