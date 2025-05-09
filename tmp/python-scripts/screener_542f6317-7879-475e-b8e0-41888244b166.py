#!/usr/bin/env python3
import sys
import json
import os

# Print Python diagnostics
print(f"Python version: {sys.version}")
print(f"Python executable: {sys.executable}")
print(f"Current working directory: {os.getcwd()}")

# The user code - directly pasted without using multi-line string to preserve indentation
import yfinance as yf
import pandas as pd
import pandas_ta as ta
import json
import sys

class SCTRCloneScreener:
    def __init__(self, symbols=None):
        self.symbols = symbols or ["AAPL", "MSFT", "TSLA", "NVDA", "AMD", "META", "GOOGL"]

    def fetch_data(self, symbol):
        try:
            df = yf.download(symbol, period="6mo", progress=False)
            if df.empty or len(df) < 125:
                return None
            df.ta.ema(length=200, append=True)
            df.ta.ema(length=50, append=True)
            df.ta.roc(length=125, append=True)
            df.ta.roc(length=20, append=True)
            df.ta.rsi(length=14, append=True)
            df.ta.ppo(append=True)
            df["ppo_slope_3d"] = df["PPOh_12_26_9"].diff().rolling(3).mean()
            return df
        except Exception as e:
            print(f"Error fetching {symbol}: {e}")
            return None

    def calculate_sctr(self, row):
        score = 0
        score += 30 if row["Close"] > row["EMA_200"] else 0
        score += min(max(row["ROC_125"], 0), 30)
        score += 15 if row["Close"] > row["EMA_50"] else 0
        score += min(max(row["ROC_20"], 0), 15)
        score += 5 if row["ppo_slope_3d"] > 0 else 0
        score += min(max(row["RSI_14"] / 100 * 5, 0), 5)
        return round(min(score, 99.9), 2)

    def run(self):
        matches = []
        for symbol in self.symbols:
            df = self.fetch_data(symbol)
            if df is None or df.empty:
                continue
            latest = df.iloc[-1]
            try:
                score = self.calculate_sctr(latest)
                matches.append({
                    "symbol": symbol,
                    "price": round(latest["Close"], 2),
                    "score": score,
                    "rsi": round(latest["RSI_14"], 1),
                    "details": f"SCTR {score}, RSI {round(latest['RSI_14'],1)}"
                })
            except Exception as e:
                print(f"Error scoring {symbol}: {e}")
                continue
        return matches

# REQUIRED ENTRY POINT
def screen_stocks(data_dict):
    print("Running self-loading SCTR Clone Screener...")
    
    # We can potentially use symbols from data_dict if needed
    symbols = list(data_dict.keys()) if data_dict else None
    
    screener = SCTRCloneScreener(symbols)
    matches = screener.run()

    result = {
        "matches": [m["symbol"] for m in matches],
        "details": {m["symbol"]: m for m in matches}
    }

    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    sys.stdout.flush()
    return result

print("Preparing data_dict for screener...")

# Create a real data dictionary with stock data to prevent empty objects
data_dict = {
    "AAPL": {"price": 187.35, "volume": 24500000, "company": "Apple Inc."},
    "MSFT": {"price": 415.56, "volume": 18200000, "company": "Microsoft Corporation"},
    "GOOGL": {"price": 179.88, "volume": 15800000, "company": "Alphabet Inc."},
    "AMZN": {"price": 186.45, "volume": 22100000, "company": "Amazon.com, Inc."},
    "META": {"price": 478.22, "volume": 12500000, "company": "Meta Platforms, Inc."},
    "TSLA": {"price": 177.50, "volume": 27300000, "company": "Tesla, Inc."},
    "NVDA": {"price": 950.02, "volume": 39800000, "company": "NVIDIA Corporation"}
}

print(f"data_dict contains {len(data_dict)} stocks with data")

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
