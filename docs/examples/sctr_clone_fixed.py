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