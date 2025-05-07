import pandas as pd
import numpy as np
import json
import sys

def validate_data(data_dict):
    """Test if data_dict is valid and contains expected data"""
    if data_dict is None:
        print("Error: data_dict is None!", file=sys.stderr)
        return False
        
    if not data_dict:
        print("Error: data_dict is empty!", file=sys.stderr)
        return False
    
    symbols = list(data_dict.keys())
    print(f"Found {len(symbols)} symbols in data_dict")
    
    if not symbols:
        print("Error: No symbols in data_dict!", file=sys.stderr)
        return False
        
    # Check first symbol
    first_symbol = symbols[0]
    df = data_dict[first_symbol]
    
    if df is None:
        print(f"Error: DataFrame for {first_symbol} is None!", file=sys.stderr)
        return False
        
    if df.empty:
        print(f"Error: DataFrame for {first_symbol} is empty!", file=sys.stderr)
        return False
        
    # Check for required columns
    required_cols = ['Close']
    missing_cols = [col for col in required_cols if col not in df.columns]
    
    if missing_cols:
        print(f"Error: Missing required columns: {missing_cols}", file=sys.stderr)
        return False
    
    # Check DataFrame contents
    print(f"\nDataFrame for {first_symbol} has these columns: {list(df.columns)}")
    print(f"DataFrame has {len(df)} rows")
    
    # Print the first few rows
    print(f"\nFirst few rows of {first_symbol} data:")
    print(df.head().to_string())
    
    return True

def screen_stocks(data_dict):
    """
    A validation screener that checks the data provided and prints diagnostics
    
    Parameters:
    data_dict: Dictionary of DataFrames with market data
    
    Returns:
    Dictionary with keys 'matches' containing list of matching symbols
    """
    print("Starting data validation screener...")
    
    # Check the data
    is_valid = validate_data(data_dict)
    
    if not is_valid:
        print("Data validation failed!")
        return {
            'matches': [],
            'details': {'error': 'Data validation failed'}
        }
    
    # Initialize results
    matches = []
    details = {}
    
    # Perform a simple screen on valid data
    for symbol, df in data_dict.items():
        try:
            # Get the latest price
            latest_price = df['Close'].iloc[-1]
            
            # Simple condition - price > 100
            if latest_price > 100:
                matches.append(symbol)
                details[symbol] = {
                    'price': float(latest_price),  # Convert numpy values to Python types for JSON
                    'reason': 'Price > 100'
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
            'Close': [150.0, 155.0, 160.0],
            'Open': [145.0, 150.0, 155.0],
            'High': [152.0, 158.0, 162.0],
            'Low': [144.0, 149.0, 154.0],
            'Volume': [1000000, 1200000, 1100000]
        }),
        'MSFT': pd.DataFrame({
            'Close': [250.0, 260.0, 270.0],
            'Open': [245.0, 255.0, 265.0],
            'High': [252.0, 262.0, 272.0],
            'Low': [243.0, 253.0, 263.0],
            'Volume': [800000, 850000, 900000]
        })
    }
    
    # Set index as DatetimeIndex to simulate real data
    for symbol in test_data:
        test_data[symbol].index = pd.date_range(start='2023-01-01', periods=len(test_data[symbol]))
    
    # Run the screener
    results = screen_stocks(test_data)
    
    # Print results as JSON
    print("\nFinal JSON output:")
    print(json.dumps(results, indent=2))