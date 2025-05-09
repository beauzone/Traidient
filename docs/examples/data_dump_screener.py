import json
import sys
import pprint

def screen_stocks(data_dict):
    """
    This screener simply dumps the raw data_dict as output to help debug.
    """
    print(f"Data Dump Screener running with {len(data_dict)} symbols")
    
    # Create a minimal result for the app
    matches = list(data_dict.keys())[:5]  # Just take first few symbols
    
    # Create a simplified version of data_dict that's JSON-serializable
    simple_data = {}
    for symbol, data in data_dict.items():
        if isinstance(data, dict):
            # Convert all values to strings for safety
            simple_data[symbol] = {k: str(v)[:100] + '...' if len(str(v)) > 100 else str(v) 
                              for k, v in data.items() if k != 'historical'}
            
            # Add simplified historical info if present
            if 'historical' in data and isinstance(data['historical'], list):
                hist_data = data['historical']
                simple_data[symbol]['historical_count'] = len(hist_data)
                if hist_data:
                    simple_data[symbol]['historical_sample'] = {
                        k: str(v)[:50] for k, v in hist_data[0].items()
                    }
        else:
            simple_data[symbol] = str(type(data))
    
    # Create detailed results
    details = {symbol: {"data": simple_data.get(symbol, {})} for symbol in matches}
    
    # Final result
    result = {
        "matches": matches,
        "details": details,
        "data_format": simple_data
    }
    
    # Output with required markers
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    sys.stdout.flush()
    
    return result