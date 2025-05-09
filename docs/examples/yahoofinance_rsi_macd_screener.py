import pandas as pd
import numpy as np
import json
import yfinance as yf

def screen_stocks(data_dict):
    """
    An RSI-MACD screener using yfinance data instead of Alpaca API
    This version should work reliably with the execution service
    """
    print("=" * 50)
    print("RSI-MACD CROSSOVER SCREENER (YAHOO FINANCE VERSION)")
    print("=" * 50)
    
    # Initialize results
    matches = []
    details = {}
    
    # List of stocks to screen (common large cap tech stocks)
    symbols = [
        "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", "AMD", "INTC", "IBM",
        "JPM", "BAC", "WFC", "GS", "MS", "V", "MA", "PYPL", "DIS", "NFLX"
    ]
    
    print(f"Screening {len(symbols)} symbols using Yahoo Finance data")
    
    for symbol in symbols:
        try:
            print(f"Fetching data for {symbol}...")
            
            # Get data from Yahoo Finance (last 50 days to have enough for calculations)
            stock = yf.Ticker(symbol)
            df = stock.history(period="50d")
            
            if df.empty or len(df) < 30:
                print(f"Not enough data for {symbol}, skipping")
                continue
            
            # Calculate RSI (14-period)
            delta = df['Close'].diff()
            gain = delta.clip(lower=0)
            loss = -delta.clip(upper=0)
            
            avg_gain = gain.rolling(window=14).mean()
            avg_loss = loss.rolling(window=14).mean()
            
            rs = avg_gain / avg_loss
            df['rsi'] = 100 - (100 / (1 + rs))
            
            # Calculate MACD (12, 26, 9)
            df['ema12'] = df['Close'].ewm(span=12, adjust=False).mean()
            df['ema26'] = df['Close'].ewm(span=26, adjust=False).mean()
            
            df['macd_line'] = df['ema12'] - df['ema26']
            df['signal_line'] = df['macd_line'].ewm(span=9, adjust=False).mean()
            
            # Get the latest values
            latest = df.iloc[-1]
            previous = df.iloc[-2]
            
            # Check for bullish RSI and MACD conditions
            rsi_value = latest['rsi']
            macd_over_signal = latest['macd_line'] > latest['signal_line']
            macd_crossover = (latest['macd_line'] > latest['signal_line']) and (previous['macd_line'] <= previous['signal_line'])
            
            # Print indicator values
            print(f"{symbol} - Current indicators:")
            print(f"  RSI: {rsi_value:.2f}")
            print(f"  MACD Line: {latest['macd_line']:.4f}")
            print(f"  Signal Line: {latest['signal_line']:.4f}")
            print(f"  MACD > Signal: {macd_over_signal}")
            print(f"  MACD Crossover: {macd_crossover}")
            
            # Define conditions for a match
            is_match = False
            match_reasons = []
            
            # RSI condition: Value between 40 and 70 (not overbought, but showing strength)
            if 40 <= rsi_value <= 70:
                match_reasons.append(f"RSI at {rsi_value:.2f} shows good momentum")
                
                # MACD conditions (only check if RSI condition is met)
                if macd_crossover:
                    match_reasons.append("Bullish MACD crossover (MACD line crossed above signal line)")
                    is_match = True
                elif macd_over_signal:
                    match_reasons.append("MACD line above signal line")
                    is_match = True
            
            # If this stock matches our criteria, add it to the results
            if is_match:
                matches.append(symbol)
                details[symbol] = {
                    "price": float(latest['Close']),
                    "rsi": float(rsi_value),
                    "macd_line": float(latest['macd_line']),
                    "signal_line": float(latest['signal_line']),
                    "volume": float(latest['Volume']),
                    "reasons": match_reasons
                }
                
                print(f"✅ MATCH: {symbol} - {', '.join(match_reasons)}")
            else:
                print(f"❌ NO MATCH: {symbol} - Does not meet screening criteria")
        
        except Exception as e:
            print(f"Error processing {symbol}: {str(e)}")
    
    # If no matches found, explain why
    if not matches:
        print("No stocks matched the RSI-MACD criteria")
    
    # Print final result count
    print(f"Found {len(matches)} matching stocks")
    
    # Prepare the result
    result = {
        'matches': matches,
        'details': details
    }
    
    # Print with special markers for proper extraction
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    
    return result