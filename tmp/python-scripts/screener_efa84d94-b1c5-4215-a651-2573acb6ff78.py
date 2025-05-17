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
import numpy as np
import pandas_ta as ta
import json
import sys
from datetime import datetime

def screen_stocks(data_dict, parameters=None):
    if parameters is None:
        parameters = {}

    results = []
    spy_df = data_dict.get("SPY", None)
    if spy_df is not None:
        spy_prices = spy_df['Close']
        spy_sma18 = ta.sma(spy_prices, length=18)
    else:
        spy_prices = spy_sma18 = None

    for symbol, df in data_dict.items():
        try:
            if len(df) < 60:
                continue

            df = df.copy()
            df['sma_4'] = ta.sma(df['Close'], length=4)
            df['sma_18'] = ta.sma(df['Close'], length=18)
            df['sma_40'] = ta.sma(df['Close'], length=40)
            df['sma_vol_20'] = ta.sma(df['Volume'], length=20)
            df['macd'] = ta.macd(df['Close'])['MACD_12_26_9']
            df['rsi'] = ta.rsi(df['Close'], length=14)
            df['mfi'] = ta.mfi(df['High'], df['Low'], df['Close'], df['Volume'], length=14)
            adx_df = ta.adx(df['High'], df['Low'], df['Close'], length=13)
            df = pd.concat([df, adx_df], axis=1)

            df.fillna(method='ffill', inplace=True)
            df.dropna(inplace=True)

            latest = df.iloc[-1]
            prev = df.iloc[-2]

            if latest['sma_vol_20'] < 500_000 or latest['sma_4'] < 5:
                continue

            if latest['sma_18'] < prev['sma_18']:
                continue

            if latest['macd'] < 0 or latest['rsi'] < 50 or latest['mfi'] < 50:
                continue

            if latest['DMP_13'] < latest['DMN_13'] or latest['ADX_13'] >= 30:
                continue

            if latest['Close'] < latest['sma_40']:
                continue

            cond1 = latest['sma_18'] < latest['sma_40'] and prev['Close'] <= prev['sma_40']
            cond2 = (
                latest['sma_18'] > latest['sma_40'] and
                df['Low'].iloc[-2:].min() <= latest['sma_18'] and
                latest['Close'] > latest['sma_18']
            )

            if not (cond1 or cond2):
                continue

            # Relative strength check vs SPY
            if spy_prices is not None and symbol != "SPY":
                rel = df['Close'] / spy_prices[-len(df):]
                rel_sma18 = ta.sma(rel, length=18)
                if rel.iloc[-1] <= rel_sma18.iloc[-1]:
                    continue

            result = {
                "symbol": symbol,
                "score": 90,
                "recommendation": "BUY",
                "details": {
                    "macd": round(latest['macd'], 2),
                    "rsi": round(latest['rsi'], 2),
                    "mfi": round(latest['mfi'], 2),
                    "adx": round(latest['ADX_13'], 2),
                    "plus_di": round(latest['DMP_13'], 2),
                    "minus_di": round(latest['DMN_13'], 2),
                    "sma_18": round(latest['sma_18'], 2),
                    "sma_40": round(latest['sma_40'], 2),
                },
                "price": round(latest['Close'], 2),
                "strength": "STRONG",
                "pattern": "Cupping SMA18 Setup",
                "timeframe": "1d",
                "date": df.index[-1].isoformat()
            }

            results.append(result)

        except Exception as e:
            print(f"Error processing {symbol}: {str(e)}", file=sys.stderr)
            continue

    results = sorted(results, key=lambda x: x['score'], reverse=True)[:50]
    return format_results(results)

def format_results(results):
    json_str = json.dumps(results)
    return f"RESULT_JSON_START\n{json_str}\nRESULT_JSON_END"

if __name__ == "__main__":
    sys.stdout.reconfigure(line_buffering=True)


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
