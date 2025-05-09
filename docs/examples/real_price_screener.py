import json
import sys

def screen_stocks(data_dict):
    """
    A screener that categorizes stocks based on their real price ranges.
    Uses real market data provided by the server.
    """
    print(f"Running Real Price Screener for {len(data_dict)} symbols")
    
    # Initialize categories
    categories = {
        "low_price": [],       # Under $50
        "medium_price": [],    # $50 to $200
        "high_price": [],      # $200 to $500
        "ultra_price": []      # Over $500
    }
    
    # Track matches and details
    matches = []
    details = {}
    
    # Print first few stocks for debugging
    print("First few stocks in data_dict:")
    for symbol, data in list(data_dict.items())[:3]:
        print(f"  {symbol}: {data}")
    
    # Process each stock in data_dict
    for symbol, data in data_dict.items():
        print(f"Processing {symbol}")
        try:
            # Extract price data
            price = data.get('price', 0)
            volume = data.get('volume', 0)
            company = data.get('company', symbol)
            is_placeholder = data.get('is_placeholder', False)
            
            # Add to matches if it has real price data
            if price > 0 and not is_placeholder:
                matches.append(symbol)
                
                # Categorize by price
                if price < 50:
                    category = "low_price"
                    categories["low_price"].append(symbol)
                elif price < 200:
                    category = "medium_price"
                    categories["medium_price"].append(symbol)
                elif price < 500:
                    category = "high_price"
                    categories["high_price"].append(symbol)
                else:
                    category = "ultra_price"
                    categories["ultra_price"].append(symbol)
                
                # Add details for each match
                details[symbol] = {
                    "symbol": symbol,
                    "company": company,
                    "price": price,
                    "volume": volume,
                    "category": category,
                    "formatted_price": f"${price:.2f}"
                }
                
                print(f"  Added {symbol} to {category} with price ${price:.2f}")
        except Exception as e:
            print(f"Error processing {symbol}: {str(e)}")
    
    # Print summary of categories
    print("\nCategory Summary:")
    for category, symbols in categories.items():
        print(f"  {category}: {len(symbols)} stocks")
        
    # Print overall summary
    print(f"\nTotal matches: {len(matches)}")
    
    # Create the result
    result = {
        "matches": matches,
        "details": details,
        "categories": categories,
        "meta": {
            "total_symbols": len(data_dict),
            "total_matches": len(matches),
            "category_counts": {category: len(symbols) for category, symbols in categories.items()},
            "used_real_data": True
        }
    }
    
    # Output with special markers
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    sys.stdout.flush()
    
    return result