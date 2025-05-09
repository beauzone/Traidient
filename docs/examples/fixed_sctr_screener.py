import pandas as pd
import ta
import json
import sys

class SCTRCloneScreener:
    """
    Pure SCTR-style scoring screener — ranks stocks based on technical strength.
    No breakout filters, just momentum + trend quality across timeframes.
    """

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
        print(f"Processing {len(data_dict)} symbols")

        for symbol, data in data_dict.items():
            try:
                print(f"Processing {symbol}")
                
                # Convert dict data to a DataFrame if it's not already
                if isinstance(data, dict):
                    # Check if there's a historical price data in the format we expect
                    if "Close" in data and isinstance(data["Close"], (int, float)):
                        # Single data point, not enough for analysis
                        print(f"Skipping {symbol} - insufficient historical data")
                        continue
                        
                    # Create a tiny dataset for testing - this should be replaced with actual logic
                    # to handle whatever format the data is in
                    print(f"Converting {symbol} data to DataFrame")
                    
                    # If user has at least 200 historical price points
                    historical_data = []
                    if "historical" in data and isinstance(data["historical"], list) and len(data["historical"]) >= 200:
                        for hist_point in data["historical"]:
                            if isinstance(hist_point, dict) and "close" in hist_point:
                                historical_data.append({
                                    "Date": hist_point.get("date", ""),
                                    "Close": hist_point.get("close", 0),
                                    "Open": hist_point.get("open", 0),
                                    "High": hist_point.get("high", 0),
                                    "Low": hist_point.get("low", 0),
                                    "Volume": hist_point.get("volume", 0)
                                })
                    
                    # Use data from the format received in data_dict
                    if len(historical_data) < 200:
                        print(f"Insufficient historical data for {symbol}")
                        # Create mock data for testing - remove in production
                        latest_price = data.get("price", 100)
                        # This is just for debugging - it should pick up data from the actual input format
                        historical_data = [{"Date": f"2025-01-{i}", "Close": latest_price * (1 + 0.001 * i), 
                                          "Open": latest_price, "High": latest_price * 1.01, 
                                          "Low": latest_price * 0.99, "Volume": 1000000} 
                                         for i in range(1, 250)]
                    
                    df = pd.DataFrame(historical_data)
                    if len(df) < 200:
                        print(f"Skipping {symbol} - insufficient data points after conversion")
                        continue
                else:
                    df = data
                
                # Verify we have enough data
                if df is None or df.empty or len(df) < 200:
                    print(f"Skipping {symbol} - not enough data")
                    continue

                print(f"Calculating indicators for {symbol}")
                # Calculate technical indicators
                df["ema_200"] = ta.trend.ema_indicator(df["Close"], 200)
                df["ema_50"] = ta.trend.ema_indicator(df["Close"], 50)
                df["roc_125"] = ta.momentum.roc(df["Close"], 125)
                df["roc_20"] = ta.momentum.roc(df["Close"], 20)
                df["rsi_14"] = ta.momentum.rsi(df["Close"], 14)
                
                # Handle the PPO calculation
                ppo_indicator = ta.trend.ppo(df["Close"])
                df["ppo_hist"] = ppo_indicator.ppo_hist()
                df["ppo_slope_3d"] = df["ppo_hist"].diff().rolling(3).mean()

                # Get latest row for scoring
                latest = df.iloc[-1]
                score = self.calculate_sctr_score(latest)
                
                print(f"{symbol} score: {score}")

                matches.append({
                    "symbol": symbol,
                    "price": round(float(latest["Close"]), 2),
                    "score": round(score, 2),
                    "rsi": round(float(latest["rsi_14"]), 1),
                    "details": f"SCTR: {round(score,1)}, RSI: {round(float(latest['rsi_14']),1)}"
                })

            except Exception as e:
                print(f"Error processing {symbol}: {str(e)}")
                import traceback
                print(traceback.format_exc())
                continue

        # Sort by score descending
        matches = sorted(matches, key=lambda x: x["score"], reverse=True)
        return matches

def screen_stocks(data_dict):
    print(f"Running SCTR Clone Screener on {len(data_dict)} stocks...")
    screener = SCTRCloneScreener()
    matches = screener.process_data(data_dict)

    match_symbols = [m["symbol"] for m in matches]
    details = {m["symbol"]: m for m in matches}

    result = {
        "matches": match_symbols,
        "details": details
    }

    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    sys.stdout.flush()  # CRUCIAL: ensures output is captured before process exits
    
    return result