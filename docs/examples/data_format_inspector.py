import json
import sys
import pprint

def screen_stocks(data_dict):
    """
    This screener analyzes the actual data format being sent to screeners.
    It doesn't try to do any calculations, just reports on the structure.
    """
    print(f"Data Format Inspector running with {len(data_dict)} symbols")
    
    # Initialize results
    matches = []
    details = {}
    
    # First, check what symbols we have
    symbols = list(data_dict.keys())
    print(f"Available symbols: {symbols}")
    
    # Inspect the structure of the first symbol
    if symbols:
        first_symbol = symbols[0]
        first_data = data_dict[first_symbol]
        
        # What kind of data do we get?
        data_type = type(first_data).__name__
        print(f"\nData type for {first_symbol}: {data_type}")
        
        # For dictionaries, check the keys
        if isinstance(first_data, dict):
            print(f"\nKeys in {first_symbol} data:")
            for key in first_data.keys():
                try:
                    if key != 'historical' or not isinstance(first_data[key], list):
                        value_type = type(first_data[key]).__name__
                        value_preview = str(first_data[key])[:50] + '...' if len(str(first_data[key])) > 50 else str(first_data[key])
                        print(f"  - {key}: {value_type} = {value_preview}")
                except Exception as e:
                    print(f"  - {key}: Error getting value: {e}")
            
            # Check if we have historical data and what it looks like
            if 'historical' in first_data and isinstance(first_data['historical'], list):
                hist_data = first_data['historical']
                print(f"\nHistorical data for {first_symbol}:")
                print(f"  - {len(hist_data)} historical data points")
                
                if hist_data:
                    print(f"  - First historical entry:")
                    first_hist = hist_data[0]
                    for key, value in first_hist.items():
                        print(f"    * {key}: {type(value).__name__} = {value}")
        
        # Add all symbols to matches for demo purposes
        for symbol in symbols:
            matches.append(symbol)
            details[symbol] = {
                "symbol": symbol,
                "data_type": type(data_dict[symbol]).__name__,
                "has_price": isinstance(data_dict[symbol], dict) and "price" in data_dict[symbol],
                "keys": list(data_dict[symbol].keys()) if isinstance(data_dict[symbol], dict) else "N/A",
                "has_historical": isinstance(data_dict[symbol], dict) and "historical" in data_dict[symbol]
            }
    
    # Create our results
    result = {
        "matches": matches,
        "details": details
    }
    
    # Output with required markers
    print("\nRESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    sys.stdout.flush()
    
    return result