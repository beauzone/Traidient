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
import json
import sys

def screen_stocks(data_dict):
    """
    An advanced screener that demonstrates working with real price data.
    Uses actual market prices to categorize stocks into different groups,
    showing various price ranges and volume categories.
    """
    print(f"Advanced Real Price Screener started with {len(data_dict)} symbols")
    
    # Initialize categories and results
    price_categories = {
        "low_price": [],          # Under $50
        "medium_price": [],       # $50 to $199
        "high_price": [],         # $200 to $499
        "ultra_price": []         # $500+
    }
    
    volume_categories = {
        "low_volume": [],         # Under 1M
        "medium_volume": [],      # 1M to 10M
        "high_volume": []         # 10M+
    }
    
    # Track all matches and their details
    matches = []
    details = {}
    
    # Check if we have placeholder data
    using_placeholder = False
    for symbol, data in data_dict.items():
        if data.get('is_placeholder', False):
            using_placeholder = True
            break
    
    print(f"Using placeholder data: {using_placeholder}")
    
    # Print the first few entries for debugging
    print("Sample of data received:")
    for symbol in list(data_dict.keys())[:3]:
        print(f"  {symbol}: {data_dict[symbol]}")
    
    # Process each stock
    for symbol, data in data_dict.items():
        # Skip if we don't have enough data
        if 'price' not in data or data['price'] <= 0:
            continue
            
        # Extract data
        price = data['price']
        volume = data.get('volume', 0)
        company = data.get('company', symbol)
        
        # Add to matches
        matches.append(symbol)
        
        # Categorize by price
        if price < 50:
            category = "low_price"
            price_categories["low_price"].append(symbol)
        elif price < 200:
            category = "medium_price"
            price_categories["medium_price"].append(symbol)
        elif price < 500:
            category = "high_price"
            price_categories["high_price"].append(symbol)
        else:
            category = "ultra_price"
            price_categories["ultra_price"].append(symbol)
        
        # Categorize by volume
        if volume < 1000000:
            vol_category = "low_volume"
            volume_categories["low_volume"].append(symbol)
        elif volume < 10000000:
            vol_category = "medium_volume"
            volume_categories["medium_volume"].append(symbol)
        else:
            vol_category = "high_volume"
            volume_categories["high_volume"].append(symbol)
        
        # Add detailed information
        details[symbol] = {
            "symbol": symbol,
            "company": company,
            "price": price,
            "volume": volume,
            "price_category": category,
            "volume_category": vol_category,
            "formatted_price": f"${price:.2f}",
            "formatted_volume": f"{volume:,}"
        }
        
        print(f"Processed {symbol} - Price: ${price:.2f}, Category: {category}, Volume: {volume:,}")
    
    # Print summary of categories
    print("\nPrice Category Summary:")
    for category, symbols in price_categories.items():
        print(f"  {category}: {len(symbols)} stocks")
    
    print("\nVolume Category Summary:")
    for category, symbols in volume_categories.items():
        print(f"  {category}: {len(symbols)} stocks")
    
    # Create the result object
    result = {
        "matches": matches,
        "details": details,
        "price_categories": price_categories,
        "volume_categories": volume_categories,
        "meta": {
            "total_symbols": len(data_dict),
            "total_matches": len(matches),
            "price_category_counts": {cat: len(symbols) for cat, symbols in price_categories.items()},
            "volume_category_counts": {cat: len(symbols) for cat, symbols in volume_categories.items()},
            "using_real_data": not using_placeholder
        }
    }
    
    # Print markers for JSON extraction
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    sys.stdout.flush()
    
    return result

print("Preparing data_dict for screener...")

# Load real market data from server (pre-fetched)
data_dict = {
  "SPY": {
    "price": 564.8,
    "volume": 22676903,
    "company": "SPDR S&P 500",
    "open": 566.48,
    "high": 567.5,
    "low": 562.7637,
    "previousClose": 565.06,
    "marketCap": 518363283456,
    "change": -0.26001,
    "changePercent": -0.04601458,
    "is_placeholder": false
  },
  "QQQ": {
    "price": 488.19,
    "volume": 20076823,
    "company": "Invesco QQQ Trust, Series 1",
    "open": 490.28,
    "high": 491.54,
    "low": 486.21,
    "previousClose": 488.29,
    "marketCap": 191907495936,
    "change": -0.1000061,
    "changePercent": -0.020480882,
    "is_placeholder": false
  },
  "DIA": {
    "price": 412.81,
    "volume": 981888,
    "company": "SPDR Dow Jones Industrial Avera",
    "open": 414.44,
    "high": 415.17,
    "low": 411.57,
    "previousClose": 413.88,
    "marketCap": 33537880064,
    "change": -1.0700073,
    "changePercent": -0.2585308,
    "is_placeholder": false
  },
  "IWM": {
    "price": 200.81,
    "volume": 11014099,
    "company": "iShares Russell 2000 ETF",
    "open": 201.54,
    "high": 202.28,
    "low": 199.96,
    "previousClose": 201.18,
    "marketCap": 56437645312,
    "change": -0.36999512,
    "changePercent": -0.18391249,
    "is_placeholder": false
  },
  "AAPL": {
    "price": 198.98,
    "volume": 22005684,
    "company": "Apple Inc.",
    "open": 199.005,
    "high": 200.5399,
    "low": 197.535,
    "previousClose": 197.49,
    "marketCap": 2971925479424,
    "change": 1.4899902,
    "changePercent": 0.7544636,
    "is_placeholder": false
  },
  "MSFT": {
    "price": 437.78,
    "volume": 8686907,
    "company": "Microsoft Corporation",
    "open": 440.28,
    "high": 440.58,
    "low": 435.88,
    "previousClose": 438.17,
    "marketCap": 3253817311232,
    "change": -0.39001465,
    "changePercent": -0.08900989,
    "is_placeholder": false
  },
  "GOOGL": {
    "price": 152.7118,
    "volume": 20964521,
    "company": "Alphabet Inc.",
    "open": 154.09,
    "high": 155.05,
    "low": 152.2,
    "previousClose": 154.28,
    "marketCap": 1860946100224,
    "change": -1.5681915,
    "changePercent": -1.016458,
    "is_placeholder": false
  },
  "AMZN": {
    "price": 192.3638,
    "volume": 18932422,
    "company": "Amazon.com, Inc.",
    "open": 193.375,
    "high": 194.69,
    "low": 191.16,
    "previousClose": 192.08,
    "marketCap": 2042211074048,
    "change": 0.28379822,
    "changePercent": 0.14775293,
    "is_placeholder": false
  },
  "META": {
    "price": 593.305,
    "volume": 7272766,
    "company": "Meta Platforms, Inc.",
    "open": 603.545,
    "high": 606.97,
    "low": 591.7062,
    "previousClose": 598.01,
    "marketCap": 1491764641792,
    "change": -4.705017,
    "changePercent": -0.786779,
    "is_placeholder": false
  },
  "TSLA": {
    "price": 300.03,
    "volume": 105837298,
    "company": "Tesla, Inc.",
    "open": 290.185,
    "high": 307.04,
    "low": 290.039,
    "previousClose": 284.82,
    "marketCap": 966384615424,
    "change": 15.209991,
    "changePercent": 5.340212,
    "is_placeholder": false
  },
  "NVDA": {
    "price": 116.795,
    "volume": 99182437,
    "company": "NVIDIA Corporation",
    "open": 117.345,
    "high": 118.23,
    "low": 115.21,
    "previousClose": 117.37,
    "marketCap": 2849797832704,
    "change": -0.5750046,
    "changePercent": -0.48990762,
    "is_placeholder": false
  },
  "JPM": {
    "price": 253.295,
    "volume": 2997734,
    "company": "JP Morgan Chase & Co.",
    "open": 254.5,
    "high": 255.49,
    "low": 252.34,
    "previousClose": 253.47,
    "marketCap": 703929581568,
    "change": -0.17500305,
    "changePercent": -0.069042906,
    "is_placeholder": false
  },
  "BAC": {
    "price": 41.895,
    "volume": 12944003,
    "company": "Bank of America Corporation",
    "open": 41.73,
    "high": 41.98,
    "low": 41.69,
    "previousClose": 41.6,
    "marketCap": 315548106752,
    "change": 0.295002,
    "changePercent": 0.7091395,
    "is_placeholder": false
  },
  "WMT": {
    "price": 96.9,
    "volume": 7628396,
    "company": "Walmart Inc.",
    "open": 96.75,
    "high": 97.2,
    "low": 96.2902,
    "previousClose": 97.195,
    "marketCap": 775286226944,
    "change": -0.29499817,
    "changePercent": -0.30351168,
    "is_placeholder": false
  },
  "PG": {
    "price": 157.82,
    "volume": 3278115,
    "company": "Procter & Gamble Company (The)",
    "open": 158.02,
    "high": 159,
    "low": 157.41,
    "previousClose": 158.65,
    "marketCap": 370015305728,
    "change": -0.8299866,
    "changePercent": -0.52315575,
    "is_placeholder": false
  },
  "JNJ": {
    "price": 154.955,
    "volume": 2664637,
    "company": "Johnson & Johnson",
    "open": 155.42,
    "high": 156.06,
    "low": 154.32,
    "previousClose": 155.66,
    "marketCap": 372832600064,
    "change": -0.70500183,
    "changePercent": -0.45291135,
    "is_placeholder": false
  },
  "PFE": {
    "price": 22.53,
    "volume": 23077960,
    "company": "Pfizer, Inc.",
    "open": 22.51,
    "high": 22.6,
    "low": 22.34,
    "previousClose": 22.54,
    "marketCap": 128091389952,
    "change": -0.010000229,
    "changePercent": -0.044366587,
    "is_placeholder": false
  },
  "XOM": {
    "price": 107.409,
    "volume": 5042511,
    "company": "Exxon Mobil Corporation",
    "open": 107.14,
    "high": 107.57,
    "low": 106.38,
    "previousClose": 106.07,
    "marketCap": 462894137344,
    "change": 1.3393,
    "changePercent": 1.2626605,
    "is_placeholder": false
  },
  "BA": {
    "price": 194.405,
    "volume": 4627480,
    "company": "Boeing Company (The)",
    "open": 193.55,
    "high": 195.08,
    "low": 192.18,
    "previousClose": 191.7,
    "marketCap": 146582536192,
    "change": 2.7050018,
    "changePercent": 1.41106,
    "is_placeholder": false
  },
  "DIS": {
    "price": 105.68,
    "volume": 6034067,
    "company": "Walt Disney Company (The)",
    "open": 105.255,
    "high": 106.19,
    "low": 104.76,
    "previousClose": 105.12,
    "marketCap": 191047237632,
    "change": 0.55999756,
    "changePercent": 0.5327222,
    "is_placeholder": false
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
