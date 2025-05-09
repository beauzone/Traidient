import json
import sys

def screen_stocks(data_dict):
    """
    An advanced screener that demonstrates working with real price data.
    Uses actual market prices to categorize stocks into different groups,
    showing various price ranges and volume categories.
    """
    print(f"Advanced Real Price Screener started with {len(data_dict)} symbols")
    
    # Initialize categories and results
    price_categories = {
        "low_price": [],          # Under $50
        "medium_price": [],       # $50 to $199
        "high_price": [],         # $200 to $499
        "ultra_price": []         # $500+
    }
    
    volume_categories = {
        "low_volume": [],         # Under 1M
        "medium_volume": [],      # 1M to 10M
        "high_volume": []         # 10M+
    }
    
    # Track all matches and their details
    matches = []
    details = {}
    
    # Check if we have placeholder data (handling both string "True" and boolean true)
    using_placeholder = False
    for symbol, data in data_dict.items():
        placeholder_value = data.get('is_placeholder', 'False')
        # Check for both string "True" and boolean true 
        if placeholder_value == "True" or placeholder_value is True:
            using_placeholder = True
            break
    
    print(f"Using placeholder data: {using_placeholder}")
    
    # Print the first few entries for debugging
    print("Sample of data received:")
    for symbol in list(data_dict.keys())[:3]:
        print(f"  {symbol}: {data_dict[symbol]}")
    
    # Process each stock
    for symbol, data in data_dict.items():
        # Skip if we don't have enough data
        if 'price' not in data or data['price'] <= 0:
            continue
            
        # Extract data
        price = data['price']
        volume = data.get('volume', 0)
        company = data.get('company', symbol)
        
        # Add to matches
        matches.append(symbol)
        
        # Categorize by price
        if price < 50:
            category = "low_price"
            price_categories["low_price"].append(symbol)
        elif price < 200:
            category = "medium_price"
            price_categories["medium_price"].append(symbol)
        elif price < 500:
            category = "high_price"
            price_categories["high_price"].append(symbol)
        else:
            category = "ultra_price"
            price_categories["ultra_price"].append(symbol)
        
        # Categorize by volume
        if volume < 1000000:
            vol_category = "low_volume"
            volume_categories["low_volume"].append(symbol)
        elif volume < 10000000:
            vol_category = "medium_volume"
            volume_categories["medium_volume"].append(symbol)
        else:
            vol_category = "high_volume"
            volume_categories["high_volume"].append(symbol)
        
        # Add detailed information
        details[symbol] = {
            "symbol": symbol,
            "company": company,
            "price": price,
            "volume": volume,
            "price_category": category,
            "volume_category": vol_category,
            "formatted_price": f"${price:.2f}",
            "formatted_volume": f"{volume:,}"
        }
        
        print(f"Processed {symbol} - Price: ${price:.2f}, Category: {category}, Volume: {volume:,}")
    
    # Print summary of categories
    print("\nPrice Category Summary:")
    for category, symbols in price_categories.items():
        print(f"  {category}: {len(symbols)} stocks")
    
    print("\nVolume Category Summary:")
    for category, symbols in volume_categories.items():
        print(f"  {category}: {len(symbols)} stocks")
    
    # Create the result object
    result = {
        "matches": matches,
        "details": details,
        "price_categories": price_categories,
        "volume_categories": volume_categories,
        "meta": {
            "total_symbols": len(data_dict),
            "total_matches": len(matches),
            "price_category_counts": {cat: len(symbols) for cat, symbols in price_categories.items()},
            "volume_category_counts": {cat: len(symbols) for cat, symbols in volume_categories.items()},
            "using_real_data": not using_placeholder
        }
    }
    
    # Print markers for JSON extraction
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    sys.stdout.flush()
    
    return result