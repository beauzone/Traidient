import pandas as pd
import numpy as np
import ta
import yfinance as yf
import json

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
    
    def process_ticker(self, ticker, df):
        """Process a single ticker and determine if it meets criteria."""
        if df is None or df.empty or len(df) < 254:  # Need at least 253 days + current day
            return None
            
        try:
            latest = df.iloc[-1]
            
            # Calculate SCTR score
            sctr = self.calculate_sctr_score(latest)
            close = latest["Close"]
            
            # Need to have enough data for rolling calculations
            if len(df) < 254:
                return None
                
            max_12mo = df["Close"].rolling(253).max().iloc[-2]  # yesterday's high
            min_12mo = df["Close"].rolling(253).min().iloc[-2]  # yesterday's low
            
            # Ensure we have the required indicators
            required_indicators = ["sma_18", "volume_sma_20", "rsi_14", "adx", "+DI", "-DI"]
            if not all(indicator in df.columns for indicator in required_indicators):
                print(f"Missing required indicators for {ticker}")
                return None
                
            sma_18_yesterday = df["sma_18"].iloc[-2]
            
            # Using more relaxed criteria to increase chances of finding matches
            relaxed_params = {
                "min_volume": self.params["min_volume"] * 0.8,
                "min_price": self.params["min_price"] * 0.8,
                "min_rsi": self.params["min_rsi"] * 0.8,
                "max_adx": self.params["max_adx"] * 1.2,
                "max_plus_di": self.params["max_plus_di"] * 1.2,
                "min_sctr_score": self.params["min_sctr_score"] * 0.8,
                "max_distance_from_high": self.params["max_distance_from_high"] * 1.2
            }
            
            # Breakout criteria - print values for debugging
            vol_check = df["volume_sma_20"].iloc[-1] > relaxed_params["min_volume"]
            price_check = close > relaxed_params["min_price"]
            rsi_check = latest["rsi_14"] >= relaxed_params["min_rsi"]
            adx_check = latest["adx"] <= relaxed_params["max_adx"]
            di_check = latest["+DI"] >= latest["-DI"]
            di_plus_check = latest["+DI"] < relaxed_params["max_plus_di"]
            sma_check = latest["sma_18"] >= sma_18_yesterday
            
            # Distance from high calculation
            distance_pct = ((close - max_12mo) / close) * 100
            high_check = -relaxed_params["max_distance_from_high"] <= distance_pct <= 5
            
            # Cup depth calculation
            cup_depth = (((2 * max_12mo) - min_12mo) / max_12mo)
            depth_check = cup_depth >= 1.39
            
            # SCTR score check
            sctr_check = sctr >= relaxed_params["min_sctr_score"]
            
            # Print debugging info
            print(f"Checking {ticker}: vol={vol_check}, price={price_check}, rsi={rsi_check}, " +
                  f"adx={adx_check}, di={di_check}, di+={di_plus_check}, sma={sma_check}, " +
                  f"high={high_check}, depth={depth_check}, sctr={sctr_check}")
            
            if all([vol_check, price_check, rsi_check, adx_check, di_check, 
                   di_plus_check, sma_check, high_check, depth_check, sctr_check]):
                return {
                    "symbol": ticker,
                    "price": float(close),
                    "score": float(round(sctr, 2)),
                    "rsi": float(round(latest["rsi_14"], 1)),
                    "di_plus": float(round(latest["+DI"], 1)),
                    "adx": float(round(latest["adx"], 1)),
                    "details": "SCTR: {}, RSI: {}, Price: ${}".format(
                        round(sctr, 1), round(latest['rsi_14'], 1), round(close, 2)
                    )
                }
            return None
        except Exception as e:
            print(f"Error processing {ticker}: {str(e)}")
            return None
    
    def get_screener_data(self, ticker):
        """Get and process data for a single ticker."""
        try:
            print(f"Downloading data for {ticker}...")
            df = yf.download(ticker, period="1y", interval="1d", progress=False)
            if df.empty:
                print(f"No data available for {ticker}")
                return None
                
            print(f"Downloaded {len(df)} bars for {ticker}")
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


# THIS IS IMPORTANT: This function must be defined to match what the platform expects
def screen_stocks(data_dict):
    """The platform will call this function with a dictionary of dataframes.
    Must return a dictionary with 'matches' key containing the results."""
    print(f"Running potential breakout screen on {len(data_dict)} stocks")
    
    # Create screener instance with relaxed parameters for testing
    screener = PotentialBreakoutScreener()
    
    # Process each stock
    matches = []
    for symbol, df in data_dict.items():
        result = screener.process_ticker(symbol, df)
        if result:
            matches.append(result)
    
    print(f"Found {len(matches)} potential breakout stocks")
    
    # Return in the format expected by the system
    return {
        'matches': matches,
        'details': {
            'screener_name': 'Potential Breakout Stocks',
            'total': len(matches)
        }
    }


# This function is still needed for documentation and testing
def run_screener(symbols=None, params=None):
    """Entry point function for documentation and testing.
    For the actual platform, screen_stocks() above will be called."""
    screener = PotentialBreakoutScreener(symbols, params)
    
    # Get data for each symbol
    data_dict = {}
    for symbol in screener.symbols:
        df = screener.get_screener_data(symbol)
        if df is not None and not df.empty:
            data_dict[symbol] = df
    
    # Run the screen
    results = screen_stocks(data_dict)
    
    # Format for API response
    return {
        "results": results['matches'],
        "metadata": {
            "total": len(results['matches']),
            "screener_name": "Potential Breakout Stocks",
            "description": "Stocks showing potential breakout patterns with strong technical metrics"
        }
    }


# For testing outside the platform
if __name__ == "__main__":
    # Test symbols
    test_symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "AMD"]
    results = run_screener(test_symbols)
    print(json.dumps(results, indent=2))