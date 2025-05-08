import os
import requests
import pandas as pd
import numpy as np
import json
import time
from datetime import datetime, timedelta

def screen_stocks(data_dict):
    """
    SCTR-inspired screener using Alpaca Market Data API for reliable data
    """
    print("Starting Alpaca SCTR Screener")
    
    # Configuration parameters
    params = {
        "sctr_threshold": 65,  # Minimum SCTR score to qualify
        "min_price": 20,
        "min_volume": 500000
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
    
    # Use a smaller set of major stocks
    tickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA"]
    print(f"Checking {len(tickers)} tickers for SCTR ratings")
    
    # Calculate date ranges needed for historical data
    end_date = datetime.now()
    start_date_short = (end_date - timedelta(days=30)).strftime("%Y-%m-%d")
    start_date_medium = (end_date - timedelta(days=90)).strftime("%Y-%m-%d")
    start_date_long = (end_date - timedelta(days=200)).strftime("%Y-%m-%d")
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
            
            # Get volume data
            bars_endpoint = f"{DATA_URL}/v2/stocks/{ticker}/bars"
            bars_params = {
                'timeframe': '1Day',
                'start': start_date_short,
                'end': end_date,
                'limit': 30,
                'adjustment': 'raw'
            }
            
            bars_response = requests.get(bars_endpoint, headers=headers, params=bars_params)
            
            if bars_response.status_code != 200:
                print(f"Error getting bars for {ticker}: {bars_response.status_code}")
                continue
                
            bars_data = bars_response.json()
            if 'bars' not in bars_data or not bars_data['bars']:
                print(f"No bars data for {ticker}")
                continue
            
            # Convert to DataFrame for analysis
            df = pd.DataFrame(bars_data['bars'])
            
            # Calculate average volume
            avg_volume = df['v'].mean()  # Volume
            print(f"{ticker} average volume: {avg_volume:.0f}")
            
            # Now get data for technical indicators (longer timeframe)
            long_bars_params = {
                'timeframe': '1Day',
                'start': start_date_long,
                'end': end_date,
                'limit': 200,
                'adjustment': 'raw'
            }
            
            long_bars_response = requests.get(bars_endpoint, headers=headers, params=long_bars_params)
            
            if long_bars_response.status_code != 200:
                print(f"Error getting long-term bars for {ticker}")
                continue
                
            long_bars_data = long_bars_response.json()
            if 'bars' not in long_bars_data or len(long_bars_data['bars']) < 100:
                print(f"Not enough historical data for {ticker}")
                continue
                
            # Convert to DataFrame
            df_long = pd.DataFrame(long_bars_data['bars'])
            
            # Make sure we have date as index
            df_long['t'] = pd.to_datetime(df_long['t'])
            df_long.set_index('t', inplace=True)
            
            # Calculate indicators for SCTR
            
            # Long-term components (30%)
            # 200-day EMA percent
            df_long['ema_200'] = df_long['c'].ewm(span=200, adjust=False).mean()
            df_long['pct_200ema'] = ((df_long['c'] - df_long['ema_200']) / df_long['ema_200']) * 100
            
            # 125-day ROC
            df_long['roc_125'] = df_long['c'].pct_change(periods=125) * 100
            
            # Medium-term components (30%)
            # 50-day EMA percent
            df_long['ema_50'] = df_long['c'].ewm(span=50, adjust=False).mean()
            df_long['pct_50ema'] = ((df_long['c'] - df_long['ema_50']) / df_long['ema_50']) * 100
            
            # 20-day ROC
            df_long['roc_20'] = df_long['c'].pct_change(periods=20) * 100
            
            # Short-term components (40%)
            # 14-day RSI
            delta = df_long['c'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            df_long['rsi_14'] = 100 - (100 / (1 + rs))
            
            # 3-day slope of RSI
            df_long['rsi_slope'] = df_long['rsi_14'] - df_long['rsi_14'].shift(3)
            
            # 6-day ROC
            df_long['roc_6'] = df_long['c'].pct_change(periods=6) * 100
            
            # Volume trend
            df_long['volume_sma_20'] = df_long['v'].rolling(window=20).mean()
            df_long['volume_trend'] = ((df_long['v'] - df_long['volume_sma_20']) / df_long['volume_sma_20']) * 100
            
            # Get the latest values
            latest = df_long.iloc[-1]
            
            # Calculate SCTR components
            
            # Long-term (30%)
            lt_score = (
                min(100, max(0, latest['pct_200ema'] * 2 + 50)) * 0.15 + 
                min(100, max(0, latest['roc_125'] * 2 + 50)) * 0.15
            )
            
            # Medium-term (30%)
            mt_score = (
                min(100, max(0, latest['pct_50ema'] * 4 + 50)) * 0.15 + 
                min(100, max(0, latest['roc_20'] * 4 + 50)) * 0.15
            )
            
            # Short-term (40%)
            st_score = (
                min(100, max(0, latest['rsi_14'])) * 0.1 + 
                min(100, max(0, latest['rsi_slope'] * 4 + 50)) * 0.1 + 
                min(100, max(0, latest['roc_6'] * 4 + 50)) * 0.1 + 
                min(100, max(0, latest['volume_trend'] * 2 + 50)) * 0.1
            )
            
            # Calculate final SCTR score
            sctr_score = lt_score + mt_score + st_score
            print(f"{ticker} SCTR Score: {sctr_score:.1f}")
            
            # Check qualification criteria
            if (
                sctr_score >= params['sctr_threshold'] and
                current_price >= params['min_price'] and
                avg_volume >= params['min_volume']
            ):
                matches.append(ticker)
                
                # Create details for results
                details[ticker] = {
                    "price": float(current_price),
                    "volume": float(avg_volume),
                    "sctr": float(sctr_score),
                    "lt_score": float(lt_score),
                    "mt_score": float(mt_score),
                    "st_score": float(st_score),
                    "score": float(sctr_score),
                    "details": f"SCTR: {sctr_score:.1f}, LT: {lt_score:.1f}, MT: {mt_score:.1f}, ST: {st_score:.1f}"
                }
                
                print(f"✓ {ticker} qualified with SCTR score {sctr_score:.1f}")
            else:
                print(f"✗ {ticker} did not qualify (SCTR: {sctr_score:.1f})")
        
        except Exception as e:
            print(f"Error processing {ticker}: {str(e)}")
            continue
    
    print(f"Alpaca SCTR Screener completed. Found {len(matches)} matches with real data.")
    
    # Return in the expected format - no fallbacks used
    return {
        'matches': matches,
        'details': details
    }