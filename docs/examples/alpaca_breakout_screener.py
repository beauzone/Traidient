import os
import requests
import pandas as pd
import numpy as np
import json
from datetime import datetime, timedelta

def screen_stocks(data_dict):
    """
    Potential Breakout Screener using Alpaca Market Data API for reliable data
    Looks for stocks showing potential bullish breakout patterns.
    """
    print("Starting Alpaca Breakout Screener")
    
    # Configuration parameters
    params = {
        "min_price": 15,
        "min_volume": 500000,
        "rsi_threshold": 55,
        "volume_spike_factor": 1.5,
        "moving_avg_uptrend": True  # Require price above moving averages
    }
    
    # Will hold our matching symbols and details
    matches = []
    details = {}
    
    # Configure Alpaca API access (these should be available from environment variables)
    ALPACA_API_KEY = os.environ.get('ALPACA_API_KEY')
    ALPACA_API_SECRET = os.environ.get('ALPACA_API_SECRET')
    
    if not ALPACA_API_KEY or not ALPACA_API_SECRET:
        print("Alpaca API credentials not found in environment")
        return {'matches': [], 'details': {}}
    
    print("Alpaca API credentials found")
    
    # Alpaca API endpoints
    BASE_URL = "https://paper-api.alpaca.markets"
    DATA_URL = "https://data.alpaca.markets"
    
    # Headers for API requests
    headers = {
        'APCA-API-KEY-ID': ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
        'Accept': 'application/json'
    }
    
    # Use major stocks that are likely to provide good data
    tickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA", "JPM", "V", "DIS"]
    print(f"Checking {len(tickers)} tickers for potential breakouts")
    
    # Calculate date ranges
    end_date = datetime.now()
    start_date = (end_date - timedelta(days=60)).strftime("%Y-%m-%d")
    end_date = end_date.strftime("%Y-%m-%d")
    
    for ticker in tickers:
        try:
            print(f"Processing {ticker}...")
            
            # Get current quote data
            quote_endpoint = f"{DATA_URL}/v2/stocks/{ticker}/quotes/latest"
            quote_response = requests.get(quote_endpoint, headers=headers)
            
            if quote_response.status_code != 200:
                print(f"Error getting quote for {ticker}: {quote_response.status_code}")
                continue
                
            quote_data = quote_response.json()
            if 'quote' not in quote_data:
                print(f"No quote data for {ticker}")
                continue
                
            current_price = quote_data['quote']['ap']  # Ask price
            print(f"{ticker} current price: ${current_price}")
            
            # Get historical bars data
            bars_endpoint = f"{DATA_URL}/v2/stocks/{ticker}/bars"
            bars_params = {
                'timeframe': '1Day',
                'start': start_date,
                'end': end_date,
                'limit': 60,
                'adjustment': 'raw'
            }
            
            bars_response = requests.get(bars_endpoint, headers=headers, params=bars_params)
            
            if bars_response.status_code != 200:
                print(f"Error getting bars for {ticker}: {bars_response.status_code}")
                continue
                
            bars_data = bars_response.json()
            if 'bars' not in bars_data or len(bars_data['bars']) < 30:
                print(f"Not enough historical data for {ticker}")
                continue
            
            # Convert to DataFrame for technical analysis
            df = pd.DataFrame(bars_data['bars'])
            
            # Make sure we have date as index
            df['t'] = pd.to_datetime(df['t'])
            df.set_index('t', inplace=True)
            
            # Calculate technical indicators
            
            # Moving Averages
            df['sma_20'] = df['c'].rolling(window=20).mean()
            df['sma_50'] = df['c'].rolling(window=50).mean()
            
            # Volume indicators
            df['volume_sma_20'] = df['v'].rolling(window=20).mean()
            
            # RSI calculation
            delta = df['c'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            df['rsi_14'] = 100 - (100 / (1 + rs))
            
            # Calculate price relative to moving averages
            df['price_vs_sma20'] = (df['c'] / df['sma_20'] - 1) * 100
            df['price_vs_sma50'] = (df['c'] / df['sma_50'] - 1) * 100
            
            # Get latest values
            latest = df.iloc[-1]
            prior_day = df.iloc[-2] if len(df) > 1 else latest
            
            # Check for NaN values
            if pd.isna(latest['rsi_14']) or pd.isna(latest['volume_sma_20']):
                print(f"Missing indicator data for {ticker}")
                continue
            
            # Extract key metrics
            current_rsi = latest['rsi_14']
            current_volume = latest['v']
            avg_volume_20d = latest['volume_sma_20']
            price_vs_sma20 = latest['price_vs_sma20']
            price_vs_sma50 = latest['price_vs_sma50']
            
            # Check breakout criteria
            price_above_min = current_price > params['min_price']
            volume_above_min = avg_volume_20d > params['min_volume']
            rsi_bullish = current_rsi > params['rsi_threshold']
            volume_spike = current_volume > (avg_volume_20d * params['volume_spike_factor'])
            price_above_sma20 = price_vs_sma20 > 0
            price_above_sma50 = price_vs_sma50 > 0
            
            # Moving average uptrend check
            moving_avg_uptrend = (price_above_sma20 and price_above_sma50) if params['moving_avg_uptrend'] else True
            
            # Calculate breakout score
            breakout_score = 0
            score_breakdown = []
            
            if price_above_min:
                breakout_score += 15
                score_breakdown.append("Price above minimum")
            
            if volume_above_min:
                breakout_score += 15
                score_breakdown.append("Volume above minimum")
            
            if rsi_bullish:
                breakout_score += 20
                score_breakdown.append("RSI bullish")
            
            if volume_spike:
                breakout_score += 25
                score_breakdown.append("Volume spike")
            
            if price_above_sma20:
                breakout_score += 15
                score_breakdown.append("Above 20-day MA")
            
            if price_above_sma50:
                breakout_score += 10
                score_breakdown.append("Above 50-day MA")
            
            print(f"{ticker} breakout score: {breakout_score} - Criteria: {', '.join(score_breakdown) if score_breakdown else 'None'}")
            
            # Qualify if score meets threshold
            if breakout_score >= 60:  # At least 60% of criteria met
                matches.append(ticker)
                
                # Create detailed analysis
                detail_text = f"Price: ${round(current_price, 2)}, "
                detail_text += f"RSI: {round(current_rsi, 1)}, "
                detail_text += f"Vol: {format(int(current_volume), ',')} vs Avg: {format(int(avg_volume_20d), ',')}"
                
                details[ticker] = {
                    "price": float(current_price),
                    "rsi": float(current_rsi),
                    "volume": float(current_volume),
                    "avg_volume": float(avg_volume_20d),
                    "vs_sma20": float(price_vs_sma20),
                    "vs_sma50": float(price_vs_sma50),
                    "score": float(breakout_score),
                    "details": detail_text
                }
                
                print(f"✓ {ticker} qualifies as potential breakout with score {breakout_score}")
            else:
                print(f"✗ {ticker} does not qualify (score {breakout_score})")
                
        except Exception as e:
            print(f"Error processing {ticker}: {str(e)}")
            continue
    
    print(f"Alpaca Breakout Screener completed. Found {len(matches)} matches with real data.")
    
    # Return in the expected format - no fallbacks, only real data
    return {
        'matches': matches,
        'details': details
    }