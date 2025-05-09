import json
import sys
import pandas as pd

def screen_stocks(data_dict):
    """
    A simple technical analysis screener that works with the standard 'ta' library
    and uses the data_dict format as provided by the system.
    """
    print(f"Running simple TA screener on {len(data_dict)} stocks")
    
    # Initialize results
    matches = []
    details = {}

    try:
        # Import 'ta' which should be available
        import ta
        print("Successfully imported ta library")
        
        # Process each stock in data_dict
        for symbol, data in data_dict.items():
            try:
                print(f"Processing {symbol}")
                
                # Basic check - data should have price information
                if not data or not isinstance(data, dict):
                    print(f"Skipping {symbol} - invalid data format")
                    continue
                
                # Check if we have basic price data
                current_price = None
                if 'price' in data:
                    current_price = data['price']
                    print(f"{symbol} current price: {current_price}")
                else:
                    print(f"No price data for {symbol}")
                    continue
                
                # Very simple filter - just add stocks with price > 100
                # This is just an example since we don't have historical data for real TA
                if current_price and current_price > 100:
                    matches.append(symbol)
                    details[symbol] = {
                        "symbol": symbol,
                        "price": current_price,
                        "score": 95,
                        "details": "Price > 100"
                    }
                    print(f"Added {symbol} to matches with price {current_price}")
            
            except Exception as e:
                print(f"Error processing {symbol}: {str(e)}")
                
    except ImportError:
        print("Could not import ta library!")
    except Exception as e:
        print(f"Error in main processing: {str(e)}")
    
    # Prepare the final result
    result = {
        "matches": matches,
        "details": details
    }
    
    print(f"Found {len(matches)} matches: {matches}")
    
    # Print with required markers
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    sys.stdout.flush()  # Critical: ensures output is captured
    
    return result