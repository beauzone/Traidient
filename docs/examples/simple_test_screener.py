import pandas as pd

def screen_stocks(data_dict):
    """
    Very simple test screener that returns all stocks with price > $10
    The platform will call this function with a dictionary of dataframes.
    Must return a dictionary with 'matches' key containing the results.
    """
    print(f"Running simple test screener on {len(data_dict)} stocks")
    
    # Process each stock
    matches = []
    for symbol, df in data_dict.items():
        # Skip empty dataframes
        if df is None or df.empty:
            print(f"No data for {symbol}")
            continue
            
        try:
            # Get the latest price
            latest_price = df['Close'].iloc[-1]
            print(f"Processing {symbol} - Latest price: ${latest_price:.2f}")
            
            # Very simple check - just stocks over $10
            if latest_price > 10:
                print(f"✓ MATCH: {symbol} at ${latest_price:.2f}")
                
                # Add to matches in the expected format
                matches.append({
                    "symbol": symbol,
                    "price": float(latest_price),
                    "details": f"Price: ${latest_price:.2f}"
                })
        except Exception as e:
            print(f"Error processing {symbol}: {str(e)}")
    
    print(f"Found {len(matches)} matching stocks")
    
    # Return in the format expected by the system
    return {
        'matches': matches,
        'details': {
            'screener_name': 'Simple Test Screener',
            'description': 'Finds stocks with price > $10',
            'total': len(matches)
        }
    }