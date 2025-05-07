import pandas as pd
import numpy as np
import json
import sys

def screen_stocks(data_dict):
    """
    A minimal test screener that just returns stocks with price > 50
    
    Parameters:
    data_dict: Dictionary of DataFrames with market data
    
    Returns:
    Dictionary with keys 'matches' containing list of matching symbols
    """
    print("Starting minimal test screener...")
    
    # Initialize results
    matches = []
    details = {}
    
    # Verify we have data
    print(f"Received {len(data_dict)} symbols to analyze")
    
    for symbol, df in data_dict.items():
        try:
            if len(df) > 0:
                # Get the latest price
                latest_price = df['Close'].iloc[-1]
                
                # Simple condition - price > 50
                if latest_price > 50:
                    matches.append(symbol)
                    details[symbol] = {
                        'price': latest_price,
                        'reason': 'Price > 50'
                    }
                    print(f"  {symbol}: MATCH - price {latest_price:.2f}")
                else:
                    print(f"  {symbol}: NO MATCH - price {latest_price:.2f}")
        except Exception as e:
            print(f"Error screening {symbol}: {str(e)}")
    
    print(f"Screener completed with {len(matches)} matches")
    
    # Return results
    return {
        'matches': matches,
        'details': details
    }

# For standalone testing
if __name__ == "__main__":
    # Create test data
    test_data = {
        'AAPL': pd.DataFrame({
            'Close': [150.0, 155.0, 160.0]
        }),
        'MSFT': pd.DataFrame({
            'Close': [250.0, 260.0, 270.0]
        }),
        'XYZ': pd.DataFrame({
            'Close': [10.0, 15.0, 20.0]
        })
    }
    
    # Run the screener
    results = screen_stocks(test_data)
    
    # Print results
    print(json.dumps(results))