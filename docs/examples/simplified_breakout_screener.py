import pandas as pd
import numpy as np
import ta
import yfinance as yf
import json

class SimpleBreakoutScreener:
    """
    A simplified version of the potential breakout screener with relaxed criteria
    designed to match more stocks in the current market conditions.
    """
    
    # Relaxed parameters with lower thresholds
    default_params = {
        "min_volume": 200000,        # Reduced from 500,000
        "min_price": 5,              # Reduced from 8
        "min_rsi": 40,               # Reduced from 50
        "max_adx": 50,               # Increased from 35
        "min_sctr_score": 40,        # Reduced from 60
        "max_distance_from_high": 20 # Increased from 10
    }
    
    def __init__(self, symbols=None, params=None):
        """Initialize the screener with optional custom parameters."""
        self.params = self.default_params.copy()
        if params:
            self.params.update(params)
            
        # Default symbols if none provided - include popular stocks
        self.symbols = symbols or ["AAPL", "MSFT", "NVDA", "AMD", "TSLA", "AMZN", "META", 
                                  "GOOGL", "SPY", "QQQ", "DIA", "IWM", "XLK", "XLF", "XLE"]
    
    def process_ticker(self, symbol, df):
        """Process a single ticker and determine if it meets criteria."""
        if df is None or df.empty or len(df) < 30:  # Need at least a month of data
            print(f"Not enough data for {symbol}")
            return None
            
        try:
            # Calculate required indicators if they don't exist
            self.calculate_indicators(df)
            
            # Get latest values
            latest = df.iloc[-1]
            
            # Basic price and volume checks
            if latest["Close"] < self.params["min_price"]:
                print(f"{symbol}: Price too low (${latest['Close']:.2f})")
                return None
                
            if "volume_sma_20" in df.columns and df["volume_sma_20"].iloc[-1] < self.params["min_volume"]:
                print(f"{symbol}: Volume too low ({df['volume_sma_20'].iloc[-1]:.0f})")
                return None
            
            # RSI check - bullish momentum
            if "rsi_14" in df.columns and latest["rsi_14"] < self.params["min_rsi"]:
                print(f"{symbol}: RSI too low ({latest['rsi_14']:.1f})")
                return None
            
            # Calculate a simple technical score (0-100)
            score = self.calculate_simple_score(df, latest)
            
            # Check if overall score meets minimum threshold
            if score < self.params["min_sctr_score"]:
                print(f"{symbol}: Score too low ({score:.1f})")
                return None
            
            # All criteria passed, return the match
            print(f"✓ {symbol} MATCHED! Score: {score:.1f}, RSI: {latest.get('rsi_14', 0):.1f}, Price: ${latest['Close']:.2f}")
            
            return {
                "symbol": symbol,
                "price": float(latest["Close"]),
                "score": float(round(score, 1)),
                "details": "Score: {}, RSI: {}, Price: ${}".format(
                    round(score, 1),
                    round(latest.get("rsi_14", 0), 1),
                    round(latest["Close"], 2)
                )
            }
        except Exception as e:
            print(f"Error processing {symbol}: {str(e)}")
            return None
    
    def calculate_indicators(self, df):
        """Calculate basic technical indicators for screening."""
        try:
            # Simple moving averages
            if "sma_20" not in df.columns:
                df["sma_20"] = ta.trend.sma_indicator(df["Close"], window=20)
            
            if "sma_50" not in df.columns:
                df["sma_50"] = ta.trend.sma_indicator(df["Close"], window=50)
            
            if "sma_200" not in df.columns:
                df["sma_200"] = ta.trend.sma_indicator(df["Close"], window=200)
            
            # RSI
            if "rsi_14" not in df.columns:
                df["rsi_14"] = ta.momentum.rsi(df["Close"], window=14)
            
            # Volume average
            if "volume_sma_20" not in df.columns:
                df["volume_sma_20"] = df["Volume"].rolling(window=20).mean()
            
            # Price rate of change
            if "roc_20" not in df.columns:
                df["roc_20"] = ta.momentum.roc(df["Close"], window=20)
            
            return df
        except Exception as e:
            print(f"Error calculating indicators: {e}")
            return df
    
    def calculate_simple_score(self, df, latest):
        """Calculate a simple technical score from 0-100."""
        score = 50  # Start at neutral
        
        # Price above moving averages (bullish trend)
        if "sma_20" in df.columns and latest["Close"] > latest["sma_20"]:
            score += 10
        
        if "sma_50" in df.columns and latest["Close"] > latest["sma_50"]:
            score += 10
        
        if "sma_200" in df.columns and latest["Close"] > latest["sma_200"]:
            score += 10
        
        # RSI momentum
        if "rsi_14" in df.columns:
            if latest["rsi_14"] > 60:
                score += 10
            elif latest["rsi_14"] > 50:
                score += 5
        
        # Price momentum
        if "roc_20" in df.columns:
            roc = latest["roc_20"]
            if roc > 10:
                score += 10
            elif roc > 5:
                score += 5
            elif roc > 0:
                score += 2
        
        # Above average volume
        if "volume_sma_20" in df.columns and latest["Volume"] > latest["volume_sma_20"] * 1.5:
            score += 5
        
        # Cap the score at 100
        return min(score, 100)


# THIS IS THE REQUIRED FUNCTION FOR THE PLATFORM
def screen_stocks(data_dict):
    """
    The platform will call this function with a dictionary of dataframes.
    Must return a dictionary with 'matches' key containing the results.
    """
    print(f"Running simplified breakout screen on {len(data_dict)} stocks")
    
    # Create screener instance with relaxed parameters
    screener = SimpleBreakoutScreener()
    
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
            'screener_name': 'Simplified Breakout Screener',
            'total': len(matches)
        }
    }


# For standalone testing
def run_screener(symbols=None, params=None):
    """Entry point function for testing outside the platform."""
    screener = SimpleBreakoutScreener(symbols, params)
    
    # Get data for each symbol
    data_dict = {}
    for symbol in screener.symbols:
        try:
            print(f"Downloading data for {symbol}...")
            df = yf.download(symbol, period="6mo", interval="1d", progress=False)
            if not df.empty:
                data_dict[symbol] = df
                print(f"  Downloaded {len(df)} bars")
        except Exception as e:
            print(f"Error downloading {symbol}: {str(e)}")
    
    # Run the screen
    results = screen_stocks(data_dict)
    
    # Format for API response
    return {
        "results": results['matches'],
        "metadata": {
            "total": len(results['matches']),
            "screener_name": "Simplified Breakout Screener",
            "description": "A simplified version with relaxed criteria to match more stocks"
        }
    }


# For testing outside the platform
if __name__ == "__main__":
    test_symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "AMD", "FB", "NFLX", "SPY"]
    results = run_screener(test_symbols)
    print(json.dumps(results, indent=2))