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
import yfinance as yf
import pandas as pd
import pandas_ta as ta

# Function to load and prepare stock data
def load_data(symbols, period='1y', interval='1d'):
    data = {}
    for symbol in symbols:
        stock_data = yf.download(symbol, period=period, interval=interval)
        data[symbol] = stock_data
    return data

# Function to calculate technical indicators
def calculate_indicators(data):
    for symbol, df in data.items():
        # Calculate momentum (e.g., using RSI)
        df['RSI'] = ta.rsi(df['Close'], length=14)
        # Calculate volume change
        df['Volume_Change'] = df['Volume'].pct_change() * 100
        # Calculate Simple Moving Average for volume to identify trends
        df['Volume_SMA'] = df['Volume'].rolling(window=20).mean()
    return data

# Screening function based on criteria
def screen_stocks(data):
    selected_stocks = []
    for symbol, df in data.items():
        # Check if the latest RSI indicates strong momentum (e.g., RSI > 70)
        if df['RSI'].iloc[-1] > 70:
            # Check if the latest volume is above the 20-day SMA, indicating increasing volume
            if df['Volume'].iloc[-1] > df['Volume_SMA'].iloc[-1]:
                selected_stocks.append(symbol)
    return selected_stocks

# Main function to execute the screener
def main(symbols):
    data = load_data(symbols)
    data = calculate_indicators(data)
    screened_stocks = screen_stocks(data)
    return screened_stocks

# Example usage
symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN']
screened_stocks = main(symbols)
print("Stocks with strong momentum and increasing volume:", screened_stocks)

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
