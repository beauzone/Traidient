import pandas as pd
import numpy as np
import json
import sys
import time

def screen_stocks(data_dict):
    """
    A simple screener that works with just the data provided in data_dict
    without trying to fetch additional data from external sources.
    """
    print(f"Running simple working screener on {len(data_dict)} stocks...")
    
    # Force a small delay to ensure proper output buffering
    time.sleep(0.1)
    
    # Initialize results
    matches = []
    details = {}
    
    # Process each stock
    for symbol, data in data_dict.items():
        try:
            print(f"Processing: {symbol}")
            
            # Verify we have data in the right format
            if not isinstance(data, dict):
                print(f"Skipping {symbol}: data is not a dictionary")
                continue
            
            # Get the current price if available
            price = None
            if 'price' in data:
                price = data['price']
                print(f"{symbol} price: {price}")
            else:
                print(f"No price data for {symbol}")
                continue
            
            # Create a simple filter based just on price
            # In reality, you would use more sophisticated criteria
            if price > 100:
                # Calculate a pseudo-score based on price
                score = min(99, 50 + (price / 10))
                
                matches.append(symbol)
                details[symbol] = {
                    "symbol": symbol,
                    "price": price,
                    "score": round(score, 2),
                    "details": f"Price-based score: {round(score, 2)}"
                }
                print(f"Added {symbol} to matches with score {score}")
        except Exception as e:
            print(f"Error processing {symbol}: {str(e)}")
    
    # Format and return results
    result = {
        "matches": matches,
        "details": details
    }
    
    print(f"Found {len(matches)} matches: {matches}")
    
    # Print with required markers and flush stdout
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    sys.stdout.flush()  # CRITICAL: ensures output is captured
    
    return result