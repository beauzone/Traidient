import json
import yfinance as yf
import traceback

def screen_stocks(data_dict):
    """
    A fixed screener that properly prints results to stdout
    using the required markers
    """
    print("=" * 50)
    print("FIXED YAHOO FINANCE SCREENER")
    print("Finding stocks above threshold price")
    print("=" * 50)
    
    # Initialize results
    matches = []
    details = {}
    errors = []
    
    # List of popular tech and blue chip stocks
    symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", "AMD", 
               "NFLX", "DIS", "JPM", "V", "PG", "JNJ", "KO", "MCD", "WMT", "HD"]
    
    # Price threshold
    price_threshold = 100
    
    print(f"Scanning {len(symbols)} stocks for price above ${price_threshold}")
    
    # Process each symbol
    for symbol in symbols:
        try:
            print(f"Checking {symbol}...")
            
            # Get current data from Yahoo Finance
            stock = yf.Ticker(symbol)
            
            # Get the latest price
            latest_price = stock.history(period="1d")['Close'].iloc[-1]
            company_name = stock.info.get('shortName', 'Unknown')
            
            print(f"  {symbol} ({company_name}): ${latest_price:.2f}")
            
            # Check if price is above threshold
            if latest_price > price_threshold:
                matches.append(symbol)
                details[symbol] = {
                    "symbol": symbol,
                    "company": company_name,
                    "price": float(latest_price),
                    "reason": f"Price ${latest_price:.2f} is above threshold of ${price_threshold}"
                }
                
                print(f"✓ MATCH: {symbol} - Price ${latest_price:.2f} > ${price_threshold}")
            else:
                print(f"× NO MATCH: {symbol} - Price ${latest_price:.2f} ≤ ${price_threshold}")
                
        except Exception as e:
            print(f"Error processing {symbol}: {str(e)}")
            traceback.print_exc()
            errors.append(f"Error processing {symbol}: {str(e)}")
    
    # Print summary
    if matches:
        print(f"\nFound {len(matches)} stocks with price above ${price_threshold}:")
        for symbol in matches:
            company = details[symbol]["company"]
            price = details[symbol]["price"]
            print(f"- {symbol} ({company}): ${price:.2f}")
    else:
        print(f"\nNo stocks found with price above ${price_threshold}")
    
    if errors:
        print(f"\n{len(errors)} errors encountered during screening")
    
    # Prepare result
    result = {
        'matches': matches,
        'details': details,
        'errors': errors if errors else None
    }
    
    # THIS IS THE CRITICAL PART:
    # Print with special markers for proper stdout extraction
    print("\nRESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END\n")
    
    # We still return the result object for Python-side usage
    # but Node.js will only see what's printed to stdout between the markers
    return result

# Optional: Add a main block to make the script runnable on its own
if __name__ == "__main__":
    import sys
    
    # Default empty parameters
    params = {}
    
    # If parameters file path is provided as argument
    if len(sys.argv) > 1:
        param_file = sys.argv[1]
        try:
            with open(param_file, 'r') as f:
                params = json.load(f)
        except Exception as e:
            print(f"Error loading parameters file: {e}")
    
    # Run the screener
    result = screen_stocks(params)
    
    # This part is handled inside screen_stocks now, but could also be done here
    # print("RESULT_JSON_START")
    # print(json.dumps(result))
    # print("RESULT_JSON_END")