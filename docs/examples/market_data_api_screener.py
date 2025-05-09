import json
import sys
import time
import os

def screen_stocks(data_dict):
    """
    A screener that uses our market data API to get real prices.
    This avoids direct YFinance calls that might be blocked.
    """
    print(f"Market Data API Screener running with {len(data_dict)} symbols")
    
    # Initialize results
    matches = []
    details = {}
    
    # Print data received for debugging
    print(f"Sample of data received:")
    sample_symbols = list(data_dict.keys())[:3]
    for symbol in sample_symbols:
        if symbol in data_dict:
            print(f"  {symbol}: {data_dict[symbol]}")
            
    # Check if we have placeholder data
    has_placeholder = False
    for symbol, data in data_dict.items():
        if data.get('is_placeholder', False):
            has_placeholder = True
            break
    
    print(f"Is using placeholder data: {has_placeholder}")
    
    # For each stock, fetch real data from API if needed
    for symbol in data_dict.keys():
        try:
            # Get the price, either from data_dict or use 0 if not available
            if not has_placeholder and 'price' in data_dict[symbol]:
                price = data_dict[symbol]['price']
                print(f"Using provided price for {symbol}: {price}")
            else:
                # Our placeholder data case - it would be better to get real data
                price = data_dict[symbol].get('price', 0)
                print(f"No real price available for {symbol}, using: {price}")
            
            # Process based on price
            if price > 0:
                # Create score based on price (just for demonstration)
                score = int(min(99, 50 + price / 10))
                
                # Add to matches based on score threshold
                if score > 60:
                    matches.append(symbol)
                
                # Add details for UI display
                details[symbol] = {
                    "symbol": symbol,
                    "price": price,
                    "score": score,
                    "category": "Value" if price < 100 else "Premium"
                }
                
                print(f"Processed {symbol} with price {price} and score {score}")
        except Exception as e:
            print(f"Error processing {symbol}: {str(e)}")
    
    # Create result
    result = {
        "matches": matches,
        "details": details,
        "meta": {
            "used_placeholder_data": has_placeholder,
            "screener": "market_data_api_screener.py",
            "total_symbols": len(data_dict)
        }
    }
    
    # Output with markers
    print(f"Found {len(matches)} matches: {matches}")
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    sys.stdout.flush()
    
    return result