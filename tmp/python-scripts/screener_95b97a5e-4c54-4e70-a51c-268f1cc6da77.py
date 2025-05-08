#!/usr/bin/env python3
import sys
import json

# The user code - directly pasted without using multi-line string to preserve indentation
import pandas as pd
import numpy as np
import ta
import yfinance as yf
class PotentialBreakoutScreener:
    """
    Scans for stocks showing potential breakout patterns with StockCharts SCTR
    scoring methodology and technical filters. Looks for strong stocks trading
    near their 52-week highs with bullish momentum and favorable trend conditions.
    """
    
    # Configuration parameters with default values
    default_params = {
        "min_volume": 500000,
        "min_price": 8,
        "min_rsi": 50,
        "max_adx": 35,
        "max_plus_di": 40,
        "min_sctr_score": 60,
        "max_distance_from_high": 10,
        "min_distance_from_low": 30
    }
    
    def __init__(self, symbols=None, params=None):
        """Initialize the screener with optional custom parameters."""
        self.params = self.default_params.copy()
        if params:
            self.params.update(params)
            
        # Default symbols if none provided
        self.symbols = symbols or ["AAPL", "MSFT", "NVDA", "AMD", "TSLA", "AMZN", "META"]
    
    def run(self, symbols=None):
        """Run the screener with provided or default symbols."""
        if symbols:
            self.symbols = symbols
        
        matches = []
        details = {}
        
        for ticker in self.symbols:
            try:
                df = self.get_screener_data(ticker)
                if df is not None and not df.empty:
                    latest = df.iloc[-1]
                    
                    sctr = self.calculate_sctr_score(latest)
                    close = latest["Close"]
                    max_12mo = df["Close"].rolling(253).max().iloc[-2]  # yesterday's high
                    min_12mo = df["Close"].rolling(253).min().iloc[-2]
                    sma_18_yesterday = df["sma_18"].iloc[-2]
                    
                    # Breakout criteria
                    conditions = [
                        df["volume_sma_20"].iloc[-1] > self.params["min_volume"],
                        close > self.params["min_price"],
                        latest["rsi_14"] >= self.params["min_rsi"],
                        latest["adx"] <= self.params["max_adx"],
                        latest["+DI"] >= latest["-DI"],
                        latest["+DI"] < self.params["max_plus_di"],
                        latest["sma_18"] >= sma_18_yesterday,
                        -self.params["max_distance_from_high"] <= ((close - max_12mo) / close) * 100 <= 5,
                        (((2 * max_12mo) - min_12mo) / max_12mo) >= 1.39,
                        sctr >= self.params["min_sctr_score"]
                    ]
                    
                    if all(conditions):
                        matches.append(ticker)
                        details[ticker] = {
                            "price": float(close),
                            "score": float(round(sctr, 2)),
                            "rsi": float(round(latest["rsi_14"], 1)),
                            "di_plus": float(round(latest["+DI"], 1)),
                            "adx": float(round(latest["adx"], 1)),
                            "details": f"SCTR: {round(sctr, 1)}, RSI: {round(latest['rsi_14'], 1)}, Price: ${round(close, 2)}"
                        }
            except Exception as e:
                print(f"Error processing {ticker}: {str(e)}")
                continue
        
        # Return in format expected by the system
        return {
            "matches": matches,
            "details": details
        }
    
    def get_screener_data(self, ticker):
        """Get and process data for a single ticker."""
        try:
            df = yf.download(ticker, period="1y", interval="1d", progress=False)
            if df.empty:
                return None
                
            df.dropna(inplace=True)
            
            # Technical indicators using `ta`
            df["ema_200"] = ta.trend.ema_indicator(df["Close"], window=200)
            df["ema_50"] = ta.trend.ema_indicator(df["Close"], window=50)
            df["roc_125"] = ta.momentum.roc(df["Close"], window=125)
            df["roc_20"] = ta.momentum.roc(df["Close"], window=20)
            df["rsi_14"] = ta.momentum.rsi(df["Close"], window=14)
            
            # PPO Histogram slope (Short-Term SCTR component)
            ppo = ta.trend.ppo(df["Close"])
            df["ppo_hist"] = ppo.ppo_hist()
            df["ppo_slope_3d"] = df["ppo_hist"].diff().rolling(3).mean()
            
            # ADX and +DI/-DI
            adx = ta.trend.adx(df["High"], df["Low"], df["Close"], window=14)
            df["adx"] = adx.adx()
            df["+DI"] = adx.adx_pos()
            df["-DI"] = adx.adx_neg()
            
            # SMA for trend filter
            df["sma_18"] = ta.trend.sma_indicator(df["Close"], window=18)
            df["volume_sma_20"] = df["Volume"].rolling(window=20).mean()
            
            return df
        except Exception as e:
            print(f"Error fetching data for {ticker}: {str(e)}")
            return None
    
    def calculate_sctr_score(self, row):
        """Calculate the StockCharts Technical Rank score."""
        score = 0
        # Long-term: 60%
        if row["Close"] > row["ema_200"]: score += 30
        score += min(max(row["roc_125"], 0), 30)
        
        # Medium-term: 30%
        if row["Close"] > row["ema_50"]: score += 15
        score += min(max(row["roc_20"], 0), 15)
        
        # Short-term: 10%
        if row["ppo_slope_3d"] > 0: score += 5
        score += min(max(row["rsi_14"] / 100 * 5, 0), 5)
        
        return min(score, 99.9)
# This is the main function that the system will call
def screen_stocks(data_dict):
    """
    Entry point function that the system will call.
    Takes a data_dict containing symbols and returns matches with details.
    """
    print("Starting potential breakout stock screening...")
    
    # Extract symbols from data_dict
    symbols = list(data_dict.keys())
    print(f"Screening {len(symbols)} symbols: {', '.join(symbols[:5])}{'...' if len(symbols) > 5 else ''}")
    
    # Run the screener with the provided symbols
    screener = PotentialBreakoutScreener(symbols)
    result = screener.run()
    
    print(f"Screening complete. Found {len(result['matches'])} potential breakout stocks.")
    
    return result

# Create a test data dictionary with common stocks
data_dict = {
    "AAPL": {},
    "MSFT": {},
    "GOOGL": {},
    "AMZN": {},
    "META": {},
    "TSLA": {},
    "NVDA": {}
}

# Execute the user code in a try-except block to catch any errors
try:
    # Call the screen_stocks function which is now directly defined above
    result = screen_stocks(data_dict)
    
    # Print the result with special markers for easy extraction
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
except Exception as e:
    # Print the error with the special markers
    print(f"Error: {str(e)}")
    print("RESULT_JSON_START")
    print(json.dumps({
        "matches": [],
        "details": {"error": str(e)}
    }))
    print("RESULT_JSON_END")
