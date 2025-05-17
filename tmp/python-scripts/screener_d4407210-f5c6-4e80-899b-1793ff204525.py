#!/usr/bin/env python3
import sys
import json
import os
import time

# Print Python diagnostics
print(f"Python version: {sys.version}")
print(f"Python executable: {sys.executable}")
print(f"Current working directory: {os.getcwd()}")

# Import key packages
try:
    import pandas as pd
    import numpy as np
    print("Successfully imported pandas and numpy")
except ImportError as e:
    print(f"WARNING: Failed to import core libraries: {str(e)}")

# The user code - directly pasted without using multi-line string to preserve indentation
import pandas as pd
import pandas_ta as ta
import yfinance as yf

def load_data(symbols, start_date, end_date):
    data = {}
    for symbol in symbols:
        stock_data = yf.download(symbol, start=start_date, end=end_date)
        data[symbol] = stock_data
    return data


def calculate_indicators(data):
    for symbol, df in data.items():
        df['RSI'] = ta.rsi(df['Close'], length=14)
        df['SMA'] = ta.sma(df['Close'], length=50)
        df['Volume_SMA'] = ta.sma(df['Volume'], length=20)
        df['Volume_Increasing'] = df['Volume'] > df['Volume_SMA']
    return data


def screen_stocks(data):
    selected_stocks = []
    for symbol, df in data.items():
        if df.iloc[-1]['RSI'] > 70 and df.iloc[-1]['Volume_Increasing']:
            selected_stocks.append(symbol)
    return selected_stocks


def run_screener(symbols, start_date='2023-01-01', end_date='2023-10-01'):
    data = load_data(symbols, start_date, end_date)
    data = calculate_indicators(data)
    selected_stocks = screen_stocks(data)
    return selected_stocks

# Example usage:
symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']
result = run_screener(symbols)
print("Selected stocks with strong momentum and increasing volume:", result)

print("Preparing data_dict for screener...")

# Load real market data from server (pre-fetched)
data_dict = {}

print(f"data_dict contains {len(data_dict)} stocks with real market data")

# Execute the user code in a try-except block to catch any errors
try:
    print("Calling screen_stocks function...")
    # Call the screen_stocks function which is now directly defined above
    result = screen_stocks(data_dict)
    
    print(f"screen_stocks function returned result of type: {type(result)}")
    
    # Print the result with special markers for easy extraction
    # Added crucial flush step to ensure output is captured before process exits
    import sys
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    sys.stdout.flush()
except Exception as e:
    # Print the error with the special markers
    error_msg = str(e)
    print(f"Error executing screener: {error_msg}")
    
    # Make sure to include stdout flush in error case too
    import sys
    print("RESULT_JSON_START")
    print(json.dumps({
        "matches": [],
        "details": {},
        "errors": error_msg
    }))
    print("RESULT_JSON_END")
    sys.stdout.flush()
