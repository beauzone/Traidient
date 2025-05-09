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
import ta
import json

class SCTRBreakoutScreener:
    """
    Breakout screener using a custom SCTR-style scoring system.
    Filters for:
    - Multi-timeframe momentum (SCTR-inspired score)
    - Near 12-month highs but not overextended
    - Positive trend and volume signals
    """

    default_params = {
        "sctr_threshold": 50,
        "min_volume": 300_000,
        "min_price": 5,
        "adx_limit": 35,
        "di_max": 40,
        "lookback_high_low": 253,
        "volatility_range_min": 1.25,
        "rsi_min": 45,
        "pct_from_high_min": -15,
        "pct_from_high_max": 8
    }

    def __init__(self, params=None):
        self.params = self.default_params.copy()
        if params:
            self.params.update(params)

    def calculate_sctr_score(self, row):
        score = 0
        score += 30 if row["Close"] > row["ema_200"] else 0
        score += min(max(row["roc_125"], 0), 30)
        score += 15 if row["Close"] > row["ema_50"] else 0
        score += min(max(row["roc_20"], 0), 15)
        score += 5 if row["ppo_slope_3d"] > 0 else 0
        score += min(max(row["rsi_14"] / 100 * 5, 0), 5)
        return min(score, 99.9)

    def process_data(self, data_dict):
        matches = []

        for symbol, df in data_dict.items():
            try:
                if df is None or df.empty or len(df) < 200:
                    continue

                df["ema_200"] = ta.trend.ema_indicator(df["Close"], 200).ema_indicator()
                df["ema_50"] = ta.trend.ema_indicator(df["Close"], 50).ema_indicator()
                df["roc_125"] = ta.momentum.roc(df["Close"], 125)
                df["roc_20"] = ta.momentum.roc(df["Close"], 20)
                df["rsi_14"] = ta.momentum.rsi(df["Close"], 14)
                df["ppo_hist"] = ta.trend.ppo(df["Close"]).ppo_hist()
                df["ppo_slope_3d"] = df["ppo_hist"].diff().rolling(3).mean()
                df["sma_18"] = ta.trend.sma_indicator(df["Close"], 18).sma_indicator()
                df["volume_sma_20"] = df["Volume"].rolling(20).mean()

                adx = ta.trend.adx(df["High"], df["Low"], df["Close"], 14)
                df["adx"] = adx.adx()
                df["+DI"] = adx.adx_pos()
                df["-DI"] = adx.adx_neg()

                latest = df.iloc[-1]
                prev = df.iloc[-2]

                score = self.calculate_sctr_score(latest)
                close = latest["Close"]
                max_high = df["Close"].rolling(self.params["lookback_high_low"]).max().iloc[-2]
                min_low = df["Close"].rolling(self.params["lookback_high_low"]).min().iloc[-2]
                vr = ((2 * max_high) - min_low) / max_high if max_high > 0 else 0
                pct_from_high = ((close - max_high) / close) * 100

                conditions = [
                    latest["volume_sma_20"] > self.params["min_volume"],
                    close > self.params["min_price"],
                    latest["rsi_14"] >= self.params["rsi_min"],
                    latest["adx"] <= self.params["adx_limit"],
                    latest["+DI"] >= latest


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
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
except Exception as e:
    # Print the error with the special markers
    error_msg = str(e)
    print(f"Error executing screener: {error_msg}")
    print("RESULT_JSON_START")
    print(json.dumps({
        "matches": [],
        "details": {"error": error_msg}
    }))
    print("RESULT_JSON_END")
