import json
import pandas as pd
import numpy as np
import yfinance as yf
import traceback
from datetime import datetime, timedelta

def screen_stocks(data_dict):
    """
    A stock screener that finds potential breakout candidates
    using Yahoo Finance data
    """
    print("=" * 50)
    print("POTENTIAL BREAKOUT SCREENER")
    print("Finding stocks with tight consolidation and increased volume")
    print("=" * 50)
    
    # Initialize results
    matches = []
    details = {}
    errors = []
    
    # List of stocks to scan
    symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", "AMD", 
               "PLTR", "NET", "CRWD", "SNOW", "UBER", "SHOP", "SQ", "PYPL", 
               "DIS", "NFLX", "COIN", "RBLX", "U", "ROKU", "ZM", "DOCU"]
    
    print(f"Scanning {len(symbols)} stocks for potential breakouts")
    
    # Criteria parameters
    volume_increase_threshold = 1.5  # Volume should be 50% above average
    price_consolidation_threshold = 0.03  # Price should be within 3% range
    rsi_threshold = 50  # RSI should be above 50
    
    try:
        # Process each symbol
        for symbol in symbols:
            try:
                print(f"Analyzing {symbol}...")
                
                # Get data from Yahoo Finance - last 30 days
                stock = yf.Ticker(symbol)
                hist = stock.history(period="30d")
                
                if hist.empty or len(hist) < 20:
                    print(f"Insufficient data for {symbol}")
                    errors.append(f"Insufficient data for {symbol}")
                    continue
                
                # Extract recent data
                recent_data = hist.tail(5)  # Last 5 days
                prior_data = hist.iloc[-10:-5]  # Previous 5 days
                
                # Calculate key metrics
                current_price = hist['Close'].iloc[-1]
                recent_volume_avg = recent_data['Volume'].mean()
                prior_volume_avg = prior_data['Volume'].mean()
                volume_change = recent_volume_avg / prior_volume_avg if prior_volume_avg > 0 else 0
                
                # Calculate price range for consolidation check
                recent_high = recent_data['High'].max()
                recent_low = recent_data['Low'].min()
                price_range_pct = (recent_high - recent_low) / recent_low
                
                # Calculate basic RSI (14-day)
                delta = hist['Close'].diff()
                gain = delta.where(delta > 0, 0).rolling(window=14).mean()
                loss = -delta.where(delta < 0, 0).rolling(window=14).mean()
                rs = gain / loss
                rsi = 100 - (100 / (1 + rs))
                current_rsi = rsi.iloc[-1]
                
                # Calculate if price is near resistance
                # Resistance is defined as the recent high that price hasn't broken
                resistance = hist['High'].rolling(window=20).max().iloc[-1]
                distance_to_resistance = (resistance - current_price) / current_price
                
                # Print metrics
                print(f"  Current price: ${current_price:.2f}")
                print(f"  Volume change: {volume_change:.2f}x")
                print(f"  Price range: {price_range_pct:.2%}")
                print(f"  RSI (14): {current_rsi:.2f}")
                print(f"  Distance to resistance: {distance_to_resistance:.2%}")
                
                # Check if stock meets breakout criteria
                is_match = (
                    volume_change >= volume_increase_threshold and
                    price_range_pct <= price_consolidation_threshold and
                    current_rsi >= rsi_threshold and
                    distance_to_resistance <= 0.03  # Within 3% of resistance
                )
                
                if is_match:
                    matches.append(symbol)
                    details[symbol] = {
                        "price": float(current_price),
                        "volume_change": float(volume_change),
                        "price_range": float(price_range_pct),
                        "rsi": float(current_rsi),
                        "resistance": float(resistance),
                        "distance_to_resistance": float(distance_to_resistance),
                        "reason": f"Potential breakout: Increased volume ({volume_change:.2f}x), "
                                 f"tight price consolidation ({price_range_pct:.2%}), "
                                 f"bullish momentum (RSI: {current_rsi:.2f}), "
                                 f"near resistance ({distance_to_resistance:.2%} away)"
                    }
                    
                    print(f"✓ MATCH: {symbol} - Potential breakout candidate")
                else:
                    # If no match, explain why
                    reasons = []
                    if volume_change < volume_increase_threshold:
                        reasons.append(f"Volume change ({volume_change:.2f}x) below threshold ({volume_increase_threshold}x)")
                    if price_range_pct > price_consolidation_threshold:
                        reasons.append(f"Price range ({price_range_pct:.2%}) above threshold ({price_consolidation_threshold:.2%})")
                    if current_rsi < rsi_threshold:
                        reasons.append(f"RSI ({current_rsi:.2f}) below threshold ({rsi_threshold})")
                    if distance_to_resistance > 0.03:
                        reasons.append(f"Too far from resistance ({distance_to_resistance:.2%} > 3%)")
                    
                    print(f"× NO MATCH: {symbol} - " + "; ".join(reasons))
                    
            except Exception as e:
                print(f"Error processing {symbol}: {str(e)}")
                traceback.print_exc()
                errors.append(f"Error processing {symbol}: {str(e)}")
    
    except Exception as e:
        print(f"Critical error: {str(e)}")
        traceback.print_exc()
        errors.append(f"Critical error: {str(e)}")
    
    # Print summary
    if matches:
        print(f"\nFound {len(matches)} potential breakout candidates:")
        for symbol in matches:
            print(f"- {symbol}: {details[symbol]['reason']}")
    else:
        print("\nNo potential breakout candidates found in this scan")
    
    if errors:
        print(f"\n{len(errors)} errors encountered during screening")
    
    # Prepare result
    result = {
        'matches': matches,
        'details': details,
        'errors': errors if errors else None
    }
    
    # Print with special markers for proper extraction
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    
    return result