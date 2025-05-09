import yfinance as yf
import pandas as pd
import json
import sys
import traceback

# Log information about the Python environment
print(f"Python version: {sys.version}")
print(f"Pandas version: {pd.__version__}")

try:
    # Try to import pandas_ta - the correct way
    import pandas_ta as ta
    print("Successfully imported pandas_ta")
except ImportError:
    print("Failed to import pandas_ta, will try alternatives")
    try:
        # Fallback to traditional ta if pandas_ta isn't available
        import ta
        print("Using alternative 'ta' library instead")
    except ImportError:
        print("No technical analysis library available!")

def screen_stocks(data_dict):
    """
    Debug version of the SCTR screener with extra logging.
    """
    print(f"Starting debug SCTR screener")
    print(f"Total symbols in data_dict: {len(data_dict)}")
    
    # List the first few symbols to see what we're working with
    if data_dict:
        sample_symbols = list(data_dict.keys())[:3]
        print(f"Sample symbols: {sample_symbols}")
    
    # Initialize results
    matches = []
    details = {}
    
    try:
        # Hard-coded list of symbols to test with
        test_symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"]
        print(f"Will try to fetch data for: {test_symbols}")
        
        for symbol in test_symbols:
            try:
                print(f"Processing {symbol}...")
                
                # Get stock data directly from Yahoo Finance
                print(f"Fetching data for {symbol} from Yahoo Finance")
                df = yf.download(symbol, period="1mo", progress=False)
                
                if df is None or df.empty:
                    print(f"No data returned for {symbol}")
                    continue
                    
                print(f"Got {len(df)} data points for {symbol}")
                
                # Just use the latest price for a simple test
                latest_price = df['Close'].iloc[-1]
                print(f"Latest price for {symbol}: {latest_price}")
                
                # Add to matches
                matches.append(symbol)
                details[symbol] = {
                    "symbol": symbol,
                    "price": round(float(latest_price), 2),
                    "score": 99,  # Dummy score 
                    "details": f"Debug test match"
                }
                print(f"Added {symbol} to matches")
                
            except Exception as e:
                print(f"Error processing {symbol}: {str(e)}")
                print(traceback.format_exc())
        
    except Exception as e:
        print(f"Error in main processing: {str(e)}")
        print(traceback.format_exc())
    
    # Prepare and print the result with the required markers
    result = {
        "matches": matches,
        "details": details
    }
    
    print("Results prepared. Matches found:", len(matches))
    
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    sys.stdout.flush()  # CRUCIAL: ensures output is captured before process exits
    
    print("Finished execution")
    return result