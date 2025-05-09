import pandas as pd
import numpy as np
import json
import sys
import yfinance as yf
import time

# Import pandas_ta (which should now work after our patch)
try:
    import pandas_ta as ta
    print("Successfully imported pandas_ta")
except ImportError as e:
    print(f"Error importing pandas_ta: {e}")
    # Fall back to regular ta library
    import ta
    print("Using alternative 'ta' library instead")

class SCTRCloneScreener:
    """
    SCTR Clone Screener - fixed to work with the current environment
    and to properly fetch data when needed
    """
    def __init__(self):
        self.min_data_points = 125
    
    def calculate_sctr_score(self, df):
        """Calculate the SCTR score for a stock"""
        try:
            # Make sure we have enough data
            if len(df) < self.min_data_points:
                print(f"Not enough data points: {len(df)}")
                return 0
            
            # Calculate technical indicators using pandas_ta
            # Use pandas_ta's API pattern which is different from the regular ta library
            df.ta.ema(length=200, append=True)
            df.ta.ema(length=50, append=True)
            df.ta.roc(length=125, append=True)
            df.ta.roc(length=20, append=True)
            df.ta.rsi(length=14, append=True)
            
            # Calculate PPO and its slope
            df.ta.ppo(append=True)
            df["ppo_slope_3d"] = df["PPOh_12_26_9"].diff().rolling(3).mean()
            
            # Get latest data point
            latest = df.iloc[-1]
            
            # Calculate SCTR score components
            score = 0
            score += 30 if latest["Close"] > latest["EMA_200"] else 0
            score += min(max(latest["ROC_125"], 0), 30)
            score += 15 if latest["Close"] > latest["EMA_50"] else 0
            score += min(max(latest["ROC_20"], 0), 15)
            score += 5 if latest["ppo_slope_3d"] > 0 else 0
            score += min(max(latest["RSI_14"] / 100 * 5, 0), 5)
            
            return min(score, 99.9)
        except Exception as e:
            print(f"Error calculating SCTR score: {e}")
            import traceback
            traceback.print_exc()
            return 0
    
    def get_dataframe_from_data_dict(self, symbol, data):
        """Convert data from data_dict to a pandas DataFrame if possible"""
        try:
            if isinstance(data, pd.DataFrame):
                return data
            
            # If we have historical data in the expected format
            if isinstance(data, dict) and 'historical' in data and isinstance(data['historical'], list):
                hist_data = data['historical']
                if len(hist_data) >= self.min_data_points:
                    # Convert to DataFrame
                    df_data = []
                    for hist_point in hist_data:
                        if 'date' in hist_point and 'close' in hist_point:
                            df_data.append({
                                'Date': hist_point['date'],
                                'Close': hist_point['close'],
                                'Open': hist_point.get('open', hist_point['close']),
                                'High': hist_point.get('high', hist_point['close']),
                                'Low': hist_point.get('low', hist_point['close']),
                                'Volume': hist_point.get('volume', 0)
                            })
                    
                    if len(df_data) >= self.min_data_points:
                        df = pd.DataFrame(df_data)
                        df['Date'] = pd.to_datetime(df['Date'])
                        df.set_index('Date', inplace=True)
                        return df
            
            # If we couldn't get data from data_dict, fetch from yfinance
            print(f"Fetching data for {symbol} from Yahoo Finance")
            df = yf.download(symbol, period="6mo", progress=False)
            if df is not None and not df.empty and len(df) >= self.min_data_points:
                return df
            
            return None
        except Exception as e:
            print(f"Error converting data to DataFrame: {e}")
            return None
    
    def screen(self, data_dict):
        """Screen stocks based on SCTR criteria"""
        matches = []
        details = {}
        
        for symbol, data in data_dict.items():
            try:
                print(f"Processing {symbol}")
                
                # Get data in DataFrame format
                df = self.get_dataframe_from_data_dict(symbol, data)
                
                if df is None or df.empty or len(df) < self.min_data_points:
                    print(f"Insufficient data for {symbol}")
                    continue
                
                # Calculate SCTR score
                score = self.calculate_sctr_score(df)
                latest_price = df['Close'].iloc[-1]
                
                if score > 0:  # Only include stocks with valid scores
                    matches.append(symbol)
                    details[symbol] = {
                        "symbol": symbol,
                        "price": float(latest_price),
                        "score": float(score),
                        "rsi": float(df["RSI_14"].iloc[-1]) if "RSI_14" in df.columns else 50,
                        "details": f"SCTR: {score:.1f}"
                    }
                    print(f"Added {symbol} with score {score}")
            except Exception as e:
                print(f"Error processing {symbol}: {e}")
        
        return matches, details

def screen_stocks(data_dict):
    """Entry point for the screener"""
    print(f"Running SCTR Clone Screener on {len(data_dict)} stocks...")
    
    # Add a small delay to ensure proper output buffering
    time.sleep(0.1)
    
    screener = SCTRCloneScreener()
    matches, details = screener.screen(data_dict)
    
    result = {
        "matches": matches,
        "details": details
    }
    
    print(f"Found {len(matches)} matches")
    
    # Print with required markers
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    sys.stdout.flush()  # CRITICAL: ensures output is captured before process exits
    
    return result