#!/usr/bin/env python3
import sys
import json

# The user code - directly pasted without using multi-line string to preserve indentation
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest, StockQuotesRequest
from alpaca.data.timeframe import TimeFrame
import pandas as pd
import numpy as np
import os
from datetime import datetime, timedelta

def screen_stocks(data_dict):
    """
    A stock screener using the official Alpaca SDK (alpaca-py)
    This uses the best practices from the Alpaca documentation
    """
    print("Starting Alpaca SDK-powered Screener")
    
    # Will hold our matching symbols and details
    matches = []
    details = {}
    
    # Configure Alpaca API keys from environment variables
    API_KEY = os.environ.get('ALPACA_API_KEY')
    API_SECRET = os.environ.get('ALPACA_API_SECRET')
    
    if not API_KEY or not API_SECRET:
        print("Alpaca API credentials not found in environment")
        return {'matches': [], 'details': {}}
    
    print("Alpaca API credentials found")
    
    # Initialize the Alpaca SDK client for historical data
    client = StockHistoricalDataClient(API_KEY, API_SECRET)
    
    # Define which tickers to screen
    tickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA"]
    print(f"Checking {len(tickers)} tickers")
    
    # Define time periods for historical data requests
    end = datetime.now()
    start_short = end - timedelta(days=30)
    start_medium = end - timedelta(days=90)
    
    try:
        # Get the latest quotes for all symbols in a single request
        quotes_request = StockQuotesRequest(
            symbol_or_symbols=tickers,
            start=end - timedelta(minutes=15),
            end=end
        )
        
        print("Requesting latest quotes...")
        quotes_response = client.get_stock_quotes(quotes_request)
        
        # Check if we got any quotes
        if not quotes_response:
            print("No quotes data received")
            return {'matches': [], 'details': {}}
        
        # Get historical bars for all symbols in a single request
        bars_request = StockBarsRequest(
            symbol_or_symbols=tickers,
            timeframe=TimeFrame.Day,
            start=start_medium,
            end=end
        )
        
        print("Requesting historical bars...")
        bars_response = client.get_stock_bars(bars_request)
        
        # Check if we got any bars
        if not bars_response:
            print("No historical bars received")
            return {'matches': [], 'details': {}}
        
        # Convert bars response to a DataFrame
        bars_df = bars_response.df
        
        # Process each ticker
        for ticker in tickers:
            try:
                print(f"\nProcessing {ticker}...")
                
                # Get latest quote
                try:
                    ticker_quotes = quotes_response.get(ticker, None)
                    if not ticker_quotes or ticker_quotes.empty:
                        print(f"No quotes found for {ticker}")
                        continue
                    
                    # Get the latest quote
                    latest_quote = ticker_quotes.iloc[-1] if not ticker_quotes.empty else None
                    if latest_quote is None:
                        print(f"No valid quote for {ticker}")
                        continue
                    
                    current_price = latest_quote['ask_price']
                    print(f"{ticker} current price: ${current_price}")
                except Exception as e:
                    print(f"Error processing quotes for {ticker}: {str(e)}")
                    continue
                
                # Filter bars for this ticker
                ticker_bars = bars_df[bars_df.index.get_level_values('symbol') == ticker]
                if ticker_bars.empty:
                    print(f"No historical data for {ticker}")
                    continue
                
                # Calculate technical indicators
                # 1. Simple Moving Averages
                ticker_bars['sma_20'] = ticker_bars['close'].rolling(window=20).mean()
                ticker_bars['sma_50'] = ticker_bars['close'].rolling(window=50).mean()
                
                # 2. RSI (14-day)
                delta = ticker_bars['close'].diff()
                gain = delta.clip(lower=0).rolling(window=14).mean()
                loss = -delta.clip(upper=0).rolling(window=14).mean()
                rs = gain / loss
                ticker_bars['rsi_14'] = 100 - (100 / (1 + rs))
                
                # 3. Volume metrics
                ticker_bars['volume_sma_20'] = ticker_bars['volume'].rolling(window=20).mean()
                ticker_bars['volume_ratio'] = ticker_bars['volume'] / ticker_bars['volume_sma_20']
                
                # Get the latest values for analysis
                latest_bar = ticker_bars.iloc[-1]
                
                # Calculate trend strength (percentage from SMA)
                price_vs_sma20 = ((current_price / latest_bar['sma_20']) - 1) * 100 if not np.isnan(latest_bar['sma_20']) else 0
                price_vs_sma50 = ((current_price / latest_bar['sma_50']) - 1) * 100 if not np.isnan(latest_bar['sma_50']) else 0
                
                # Extract key metrics
                rsi = latest_bar['rsi_14'] if not np.isnan(latest_bar['rsi_14']) else 50
                avg_volume = latest_bar['volume_sma_20'] if not np.isnan(latest_bar['volume_sma_20']) else 0
                current_volume = latest_bar['volume']
                volume_ratio = latest_bar['volume_ratio'] if not np.isnan(latest_bar['volume_ratio']) else 1
                
                # Calculate screen score (0-100)
                score_components = []
                
                # RSI component (0-30)
                rsi_score = min(30, max(0, (rsi - 30) * 0.75)) if not np.isnan(rsi) else 15
                score_components.append(rsi_score)
                
                # Trend component (0-40)
                trend_score = min(40, max(0, price_vs_sma20 * 8 + 20)) if not np.isnan(price_vs_sma20) else 20
                score_components.append(trend_score)
                
                # Volume component (0-30)
                volume_score = min(30, max(0, (volume_ratio - 0.5) * 20)) if not np.isnan(volume_ratio) else 15
                score_components.append(volume_score)
                
                # Overall score
                total_score = sum(score_components)
                
                print(f"Score components - RSI: {rsi_score:.1f}, Trend: {trend_score:.1f}, Volume: {volume_score:.1f}")
                print(f"Total score: {total_score:.1f}/100")
                
                # Screening criteria (score above 60)
                if total_score >= 60:
                    matches.append(ticker)
                    
                    # Create details for results display
                    details[ticker] = {
                        "price": float(current_price),
                        "rsi": float(rsi) if not np.isnan(rsi) else 50.0,
                        "volume": float(current_volume),
                        "sma20_pct": float(price_vs_sma20) if not np.isnan(price_vs_sma20) else 0.0,
                        "sma50_pct": float(price_vs_sma50) if not np.isnan(price_vs_sma50) else 0.0,
                        "volume_ratio": float(volume_ratio) if not np.isnan(volume_ratio) else 1.0,
                        "score": float(total_score),
                        "details": f"RSI: {rsi:.1f}, Volume: {volume_ratio:.1f}x avg, SMA20: {price_vs_sma20:+.1f}%"
                    }
                    
                    print(f"✓ {ticker} matched screening criteria")
                else:
                    print(f"✗ {ticker} did not meet screening criteria")
                
            except Exception as e:
                print(f"Error analyzing {ticker}: {str(e)}")
                continue
    
    except Exception as e:
        print(f"Error in screener: {str(e)}")
        return {'matches': [], 'details': {}}
    
    print(f"\nAlpaca SDK Screener completed with {len(matches)} matches: {', '.join(matches)}")
    
    # Return in the expected format
    return {
        'matches': matches,
        'details': details
    }

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
