import json
import sys
import pprint

def screen_stocks(data_dict):
    """
    Debug screener that inspects and reports on the actual data structure
    being passed to screeners. This helps understand the format so we can
    properly adapt other screeners to work with it.
    """
    print("Running data structure inspector screener")
    print(f"data_dict contains {len(data_dict)} stocks")
    
    # Sample the first stock to examine structure
    first_symbol = next(iter(data_dict)) if data_dict else None
    
    details = {}
    matches = []
    
    if first_symbol:
        sample_data = data_dict[first_symbol]
        print(f"Sample data for {first_symbol}:")
        
        # Try to understand the data structure
        data_type = type(sample_data).__name__
        print(f"Data type: {data_type}")
        
        # If it's a dictionary, examine the keys
        if isinstance(sample_data, dict):
            print(f"Keys in data: {list(sample_data.keys())}")
            
            # Check for specific keys that might indicate historical data
            has_historical = "historical" in sample_data
            print(f"Has 'historical' key: {has_historical}")
            
            if has_historical and isinstance(sample_data["historical"], list):
                historical_count = len(sample_data["historical"])
                print(f"Historical data points: {historical_count}")
                
                if historical_count > 0:
                    print("First historical data point structure:")
                    first_point = sample_data["historical"][0]
                    print(f"Keys in historical point: {list(first_point.keys())}")
        
        # Create diagnostic info for this symbol
        details[first_symbol] = {
            "data_type": data_type,
            "available_fields": list(sample_data.keys()) if isinstance(sample_data, dict) else "N/A",
            "sample": str(sample_data)[:500] + "..." if len(str(sample_data)) > 500 else str(sample_data)
        }
        
        matches.append(first_symbol)
    
    # Report the structure of all symbols
    for symbol in list(data_dict.keys())[:5]:  # Limit to first 5 for brevity
        if symbol not in details:
            data = data_dict[symbol]
            details[symbol] = {
                "data_type": type(data).__name__,
                "keys": list(data.keys()) if isinstance(data, dict) else "N/A"
            }
            matches.append(symbol)
    
    result = {
        "matches": matches,
        "details": details
    }
    
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    sys.stdout.flush()  # CRUCIAL: ensures output is captured before process exits
    
    return result