import pandas as pd
import numpy as np
import datetime
import json
import sys

# Enable maximum debugging
DEBUG_MODE = True

def debug_print(*args, **kwargs):
    """Print function that only runs in debug mode"""
    if DEBUG_MODE:
        timestamp = datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]
        print(f"[{timestamp}]", *args, **kwargs)
        # Force flush to make sure output is visible in logs
        sys.stdout.flush()

def inspect_data_dict(data_dict):
    """Print detailed information about the input data"""
    debug_print(f"=== DATA INSPECTION ===")
    debug_print(f"data_dict type: {type(data_dict)}")
    
    # Check if data_dict is None
    if data_dict is None:
        debug_print("data_dict is None! This is a critical error.")
        return
    
    # Check if data_dict is empty
    if not data_dict:
        debug_print("data_dict is empty! No stocks to process.")
        return
    
    # Get number of stocks
    debug_print(f"Number of stocks in data_dict: {len(data_dict)}")
    
    # Print a few sample keys (stock symbols)
    symbols = list(data_dict.keys())
    sample_symbols = symbols[:5] if len(symbols) > 5 else symbols
    debug_print(f"Sample symbols: {sample_symbols}")
    
    # Inspect the first symbol in detail
    if symbols:
        first_symbol = symbols[0]
        df = data_dict[first_symbol]
        debug_print(f"\nInspecting first symbol: {first_symbol}")
        debug_print(f"  DataFrame type: {type(df)}")
        
        if df is None:
            debug_print(f"  DataFrame is None!")
        elif isinstance(df, pd.DataFrame):
            debug_print(f"  DataFrame shape: {df.shape}")
            debug_print(f"  DataFrame columns: {df.columns.tolist()}")
            debug_print(f"  DataFrame index type: {type(df.index)}")
            debug_print(f"  First few index values: {df.index[:5].tolist()}")
            debug_print(f"  Last few index values: {df.index[-5:].tolist()}")
            
            # Check if required columns exist
            required_columns = ['Open', 'High', 'Low', 'Close', 'Volume']
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                debug_print(f"  WARNING: Missing required columns: {missing_columns}")
            
            # Display a few rows of data
            if not df.empty:
                debug_print(f"\n  First row: \n{df.iloc[0]}")
                debug_print(f"\n  Last row: \n{df.iloc[-1]}")
        else:
            debug_print(f"  WARNING: DataFrame is not a pandas DataFrame but a {type(df)}")

def screen_stocks(data_dict):
    """
    Debug screener with detailed logging to identify issues.
    The platform will call this function with a dictionary of dataframes.
    Must return a dictionary with 'matches' key containing the results.
    """
    debug_print("======================== DEBUG SCREENER STARTED ========================")
    debug_print("Python version:", sys.version)
    debug_print("Pandas version:", pd.__version__)
    debug_print("NumPy version:", np.__version__)
    
    # Inspect input data
    inspect_data_dict(data_dict)
    
    # Initialize return structure early in case of exceptions
    debug_result = {
        'matches': [],
        'details': {
            'screener_name': 'Debug Screener',
            'description': 'Heavy debugging to identify issues',
            'total': 0
        }
    }
    
    try:
        debug_print(f"\n=== BEGINNING STOCK SCREENING PROCESS ===")
        
        # Check that data_dict is valid
        if not data_dict:
            debug_print("WARNING: data_dict is empty or None. Returning empty result.")
            return debug_result
        
        # Process each stock
        matches = []
        processed_count = 0
        valid_data_count = 0
        
        debug_print(f"Iterating through {len(data_dict)} stocks...")
        for symbol, df in data_dict.items():
            try:
                processed_count += 1
                debug_print(f"\nProcessing stock {processed_count}/{len(data_dict)}: {symbol}")
                
                # Check if df is valid
                if df is None:
                    debug_print(f"  DataFrame for {symbol} is None. Skipping.")
                    continue
                
                if not isinstance(df, pd.DataFrame):
                    debug_print(f"  Data for {symbol} is not a DataFrame but a {type(df)}. Skipping.")
                    continue
                
                if df.empty:
                    debug_print(f"  DataFrame for {symbol} is empty. Skipping.")
                    continue
                
                valid_data_count += 1
                
                # Check if required columns exist
                required_columns = ['Close']
                if not all(col in df.columns for col in required_columns):
                    missing = [col for col in required_columns if col not in df.columns]
                    debug_print(f"  Missing required columns: {missing}. Skipping.")
                    continue
                
                # Get latest price
                try:
                    latest_price = df['Close'].iloc[-1]
                    debug_print(f"  Latest price for {symbol}: ${latest_price:.2f}")
                    
                    # Match ALL stocks to verify the return format works
                    match_data = {
                        "symbol": symbol,
                        "price": float(latest_price),
                        "details": f"Debug match for testing"
                    }
                    matches.append(match_data)
                    debug_print(f"  ✓ Added {symbol} to matches")
                    
                except Exception as e:
                    debug_print(f"  Error getting latest price for {symbol}: {str(e)}")
            
            except Exception as e:
                debug_print(f"Error processing {symbol}: {str(e)}")
        
        debug_print(f"\n=== SCREENING SUMMARY ===")
        debug_print(f"Total stocks in data_dict: {len(data_dict)}")
        debug_print(f"Total stocks processed: {processed_count}")
        debug_print(f"Stocks with valid data: {valid_data_count}")
        debug_print(f"Matches found: {len(matches)}")
        
        # Prepare return format
        debug_result['matches'] = matches
        debug_result['details']['total'] = len(matches)
        
        # Explicitly convert to basic Python types for JSON serialization
        debug_print("\n=== FINAL RESULT STRUCTURE ===")
        debug_print(f"Result type: {type(debug_result)}")
        debug_print(f"Matches count: {len(debug_result['matches'])}")
        
        # Log the first match if available
        if debug_result['matches']:
            debug_print(f"First match sample: {debug_result['matches'][0]}")
            
        debug_print("======================== DEBUG SCREENER COMPLETED ========================")
        return debug_result
        
    except Exception as e:
        debug_print(f"CRITICAL ERROR in screen_stocks function: {str(e)}")
        debug_print("Returning empty result due to error")
        return debug_result