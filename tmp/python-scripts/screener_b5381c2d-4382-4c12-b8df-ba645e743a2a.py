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
data_dict = {
  "SPY": {
    "price": 594.2,
    "volume": 73816891,
    "company": "SPDR S&P 500",
    "open": 591.25,
    "high": 594.5,
    "low": 589.28,
    "previousClose": 590.46,
    "marketCap": 545346093056,
    "change": 3.73999,
    "changePercent": 0.633403,
    "is_placeholder": "False"
  },
  "QQQ": {
    "price": 521.51,
    "volume": 46726765,
    "company": "Invesco QQQ Trust, Series 1",
    "open": 520.52,
    "high": 521.7,
    "low": 517.1,
    "previousClose": 519.25,
    "marketCap": 205005586432,
    "change": 2.2600098,
    "changePercent": 0.43524504,
    "is_placeholder": "False"
  },
  "DIA": {
    "price": 426.55,
    "volume": 2303612,
    "company": "SPDR Dow Jones Industrial Avera",
    "open": 423.74,
    "high": 426.7762,
    "low": 422.5,
    "previousClose": 423.1584,
    "marketCap": 34654154752,
    "change": 3.39157,
    "changePercent": 0.80149,
    "is_placeholder": "False"
  },
  "IWM": {
    "price": 209.85,
    "volume": 28500932,
    "company": "iShares Russell 2000 ETF",
    "open": 208.42,
    "high": 210.12,
    "low": 207.78,
    "previousClose": 208.13,
    "marketCap": 58978340864,
    "change": 1.72,
    "changePercent": 0.826407,
    "is_placeholder": "False"
  },
  "AAPL": {
    "price": 211.26,
    "volume": 53164417,
    "company": "Apple Inc.",
    "open": 212.32,
    "high": 212.57,
    "low": 209.77,
    "previousClose": 211.45,
    "marketCap": 3155336888320,
    "change": -0.19000244,
    "changePercent": -0.089856915,
    "is_placeholder": "False"
  },
  "MSFT": {
    "price": 454.27,
    "volume": 23769078,
    "company": "Microsoft Corporation",
    "open": 452.355,
    "high": 454.35,
    "low": 448.7369,
    "previousClose": 453.13,
    "marketCap": 3376379854848,
    "change": 1.1399841,
    "changePercent": 0.25157994,
    "is_placeholder": "False"
  },
  "GOOGL": {
    "price": 166.19,
    "volume": 42262455,
    "company": "Alphabet Inc.",
    "open": 167.655,
    "high": 169.34,
    "low": 165.62,
    "previousClose": 163.96,
    "marketCap": 2023446413312,
    "change": 2.2299957,
    "changePercent": 1.3600851,
    "is_placeholder": "False"
  },
  "AMZN": {
    "price": 205.59,
    "volume": 42141065,
    "company": "Amazon.com, Inc.",
    "open": 206.85,
    "high": 206.85,
    "low": 204.374,
    "previousClose": 205.17,
    "marketCap": 2182625624064,
    "change": 0.41999817,
    "changePercent": 0.2047074,
    "is_placeholder": "False"
  },
  "META": {
    "price": 640.34,
    "volume": 18035596,
    "company": "Meta Platforms, Inc.",
    "open": 637.525,
    "high": 640.4388,
    "low": 626.15,
    "previousClose": 643.88,
    "marketCap": 1610026188800,
    "change": -3.539978,
    "changePercent": -0.5497885,
    "is_placeholder": "False"
  },
  "TSLA": {
    "price": 349.98,
    "volume": 90797726,
    "company": "Tesla, Inc.",
    "open": 346.065,
    "high": 351.62,
    "low": 342.33,
    "previousClose": 342.82,
    "marketCap": 1127271628800,
    "change": 7.1600037,
    "changePercent": 2.0885606,
    "is_placeholder": "False"
  },
  "NVDA": {
    "price": 135.4,
    "volume": 218314761,
    "company": "NVIDIA Corporation",
    "open": 136.25,
    "high": 136.31,
    "low": 133.46,
    "previousClose": 134.83,
    "marketCap": 3302080905216,
    "change": 0.56999207,
    "changePercent": 0.42274868,
    "is_placeholder": "False"
  },
  "JPM": {
    "price": 267.56,
    "volume": 8913140,
    "company": "JP Morgan Chase & Co.",
    "open": 267.5,
    "high": 268.4593,
    "low": 264.71,
    "previousClose": 267.49,
    "marketCap": 743573291008,
    "change": 0.0700073,
    "changePercent": 0.0261719,
    "is_placeholder": "False"
  },
  "BAC": {
    "price": 44.69,
    "volume": 43549977,
    "company": "Bank of America Corporation",
    "open": 44.34,
    "high": 44.79,
    "low": 43.655,
    "previousClose": 44.38,
    "marketCap": 336599711744,
    "change": 0.309998,
    "changePercent": 0.698507,
    "is_placeholder": "False"
  },
  "WMT": {
    "price": 98.24,
    "volume": 29385861,
    "company": "Walmart Inc.",
    "open": 96.14,
    "high": 99.1946,
    "low": 95.995,
    "previousClose": 96.35,
    "marketCap": 786007392256,
    "change": 1.89,
    "changePercent": 1.9616,
    "is_placeholder": "False"
  },
  "PG": {
    "price": 163.28,
    "volume": 7091798,
    "company": "Procter & Gamble Company (The)",
    "open": 162.65,
    "high": 163.43,
    "low": 161.85,
    "previousClose": 162.41,
    "marketCap": 382816485376,
    "change": 0.869995,
    "changePercent": 0.535678,
    "is_placeholder": "False"
  },
  "JNJ": {
    "price": 151.33,
    "volume": 6268118,
    "company": "Johnson & Johnson",
    "open": 149.67,
    "high": 151.49,
    "low": 149.22,
    "previousClose": 149.61,
    "marketCap": 364110577664,
    "change": 1.72,
    "changePercent": 1.14966,
    "is_placeholder": "False"
  },
  "PFE": {
    "price": 22.83,
    "volume": 31072821,
    "company": "Pfizer, Inc.",
    "open": 22.65,
    "high": 22.845,
    "low": 22.45,
    "previousClose": 22.6,
    "marketCap": 129796997120,
    "change": 0.23,
    "changePercent": 1.0177,
    "is_placeholder": "False"
  },
  "XOM": {
    "price": 108.19,
    "volume": 13957013,
    "company": "Exxon Mobil Corporation",
    "open": 108.65,
    "high": 108.89,
    "low": 107.45,
    "previousClose": 108.58,
    "marketCap": 466259968000,
    "change": -0.389999,
    "changePercent": -0.359182,
    "is_placeholder": "False"
  },
  "BA": {
    "price": 205.82,
    "volume": 8414936,
    "company": "Boeing Company (The)",
    "open": 205.69,
    "high": 206.24,
    "low": 203.02,
    "previousClose": 206.24,
    "marketCap": 155189526528,
    "change": -0.419998,
    "changePercent": -0.203645,
    "is_placeholder": "False"
  },
  "DIS": {
    "price": 113.42,
    "volume": 7218195,
    "company": "Walt Disney Company (The)",
    "open": 111.915,
    "high": 113.44,
    "low": 111.42,
    "previousClose": 112.22,
    "marketCap": 203900796928,
    "change": 1.2,
    "changePercent": 1.06933,
    "is_placeholder": "False"
  }
}

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
