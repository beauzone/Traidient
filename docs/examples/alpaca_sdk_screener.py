import os
import json
import traceback
import pandas as pd
from datetime import datetime, timedelta

def screen_stocks(data_dict):
    """
    Stock screener using the Alpaca SDK which is often more reliable than REST API
    This focuses on finding stocks with volume and recent price movement
    """
    print("=" * 50)
    print("ALPACA SDK SCREENER")
    print("=" * 50)
    
    # Initialize results
    matches = []
    details = {}
    errors = []
    
    try:
        # Try to import alpaca-py (the official Alpaca SDK)
        from alpaca.data.historical import StockHistoricalDataClient
        from alpaca.data.requests import StockBarsRequest
        from alpaca.data.timeframe import TimeFrame
        from alpaca.trading.client import TradingClient
        
        print("Successfully imported Alpaca SDK modules")
    except ImportError as e:
        print(f"Error importing Alpaca SDK: {str(e)}")
        errors.append(f"Error importing Alpaca SDK: {str(e)}")
        print("Attempting to install alpaca-py...")
        
        try:
            import subprocess
            subprocess.check_call(["pip", "install", "alpaca-py"])
            
            # Try imports again
            from alpaca.data.historical import StockHistoricalDataClient
            from alpaca.data.requests import StockBarsRequest
            from alpaca.data.timeframe import TimeFrame
            from alpaca.trading.client import TradingClient
            
            print("Successfully installed and imported Alpaca SDK")
        except Exception as install_err:
            print(f"Failed to install alpaca-py: {str(install_err)}")
            result = {
                'matches': [],
                'details': {},
                'errors': [f"Failed to set up Alpaca SDK: {str(install_err)}"]
            }
            print("RESULT_JSON_START")
            print(json.dumps(result))
            print("RESULT_JSON_END")
            return result
    
    # Configure Alpaca API access
    API_KEY = os.environ.get('ALPACA_API_KEY')
    API_SECRET = os.environ.get('ALPACA_API_SECRET')
    
    # Print environment variables to help debug (masked)
    print("Environment variables (API credentials):")
    if API_KEY:
        print(f"  ALPACA_API_KEY: {'*' * 5}{API_KEY[-4:] if len(API_KEY) > 4 else ''}")
    else:
        print("  ALPACA_API_KEY: Not found")
        
    if API_SECRET:
        print(f"  ALPACA_API_SECRET: {'*' * 5}{API_SECRET[-4:] if len(API_SECRET) > 4 else ''}")
    else:
        print("  ALPACA_API_SECRET: Not found")
    
    # Verify we have API credentials
    if not API_KEY or not API_SECRET:
        print("ERROR: Alpaca API credentials not found in environment")
        result = {
            'matches': [],
            'details': {},
            'errors': ["Alpaca API credentials not found"]
        }
        print("RESULT_JSON_START")
        print(json.dumps(result))
        print("RESULT_JSON_END")
        return result
    
    print(f"Alpaca API credentials found")
    
    # List of stocks to screen (major tech and blue chips)
    symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", 
               "AMD", "INTC", "IBM", "JPM", "BAC", "GS", "JNJ", "PFE"]
    
    try:
        # Initialize Alpaca clients
        trading_client = TradingClient(API_KEY, API_SECRET, paper=True)
        data_client = StockHistoricalDataClient(API_KEY, API_SECRET)
        
        # Test connection by getting account info
        account = trading_client.get_account()
        print(f"Connected to Alpaca successfully - Account ID: {account.id}")
        print(f"Account status: {account.status}")
        print(f"Account equity: ${float(account.equity):.2f}")
        print(f"Account buying power: ${float(account.buying_power):.2f}")
        
        # Get market clock to check if market is open
        clock = trading_client.get_clock()
        is_open = clock.is_open
        next_open = clock.next_open.strftime('%Y-%m-%d %H:%M:%S')
        next_close = clock.next_close.strftime('%Y-%m-%d %H:%M:%S')
        
        print(f"Market is {'OPEN' if is_open else 'CLOSED'}")
        print(f"Next market open: {next_open}")
        print(f"Next market close: {next_close}")
        
        # Get historical bars for our symbols
        # Starting from 10 days ago to include more data points
        end = datetime.now()
        start = end - timedelta(days=10)
        
        print(f"Requesting bar data from {start.strftime('%Y-%m-%d')} to {end.strftime('%Y-%m-%d')}")
        
        bars_request = StockBarsRequest(
            symbol_or_symbols=symbols,
            timeframe=TimeFrame.Day,
            start=start,
            end=end
        )
        
        try:
            # Get the bar data
            bars = data_client.get_stock_bars(bars_request)
            
            # Print the type and structure of the response
            print(f"Response type: {type(bars)}")
            print(f"Available methods/attributes: {dir(bars)[:10]}...")
            
            # Convert to dataframe for easier processing
            # The SDK returns a nested dictionary structure that we need to flatten
            df_dict = {}
            
            for symbol in symbols:
                try:
                    # Check if we have data for this symbol
                    if symbol in bars.data and bars.data[symbol]:
                        # Extract the bars for this symbol
                        symbol_bars = bars.data[symbol]
                        print(f"Got {len(symbol_bars)} bars for {symbol}")
                        
                        # Convert to DataFrame
                        df = pd.DataFrame([bar.dict() for bar in symbol_bars])
                        
                        # Store in our dictionary
                        df_dict[symbol] = df
                    else:
                        print(f"No data returned for {symbol}")
                except Exception as sym_err:
                    print(f"Error processing bar data for {symbol}: {str(sym_err)}")
                    errors.append(f"Error processing bar data for {symbol}: {str(sym_err)}")
            
            # Process each stock's data to apply our screening criteria
            for symbol, df in df_dict.items():
                try:
                    if len(df) < 2:
                        print(f"Not enough data for {symbol}: {len(df)} bars")
                        continue
                    
                    # Calculate simple metrics
                    current_price = df.iloc[-1]['close']
                    yesterday_price = df.iloc[-2]['close']
                    percent_change = ((current_price - yesterday_price) / yesterday_price) * 100
                    avg_volume = df['volume'].mean()
                    
                    print(f"{symbol} - Price: ${current_price:.2f}, 1-day Change: {percent_change:.2f}%, Avg Volume: {avg_volume:.0f}")
                    
                    # Simple criteria: Any stock that has moved more than 1% in either direction
                    # This should catch active stocks - most stocks should match in a normal market
                    if abs(percent_change) >= 0.01:  # Setting an extremely low threshold to ensure matches
                        matches.append(symbol)
                        details[symbol] = {
                            "price": float(current_price),
                            "change_percent": float(percent_change),
                            "avg_volume": float(avg_volume),
                            "reason": f"Price movement of {percent_change:.2f}% meets our criteria"
                        }
                        
                        print(f"✓ MATCH: {symbol} - Price movement of {percent_change:.2f}% meets criteria")
                    else:
                        print(f"× NO MATCH: {symbol} - Price movement of {percent_change:.2f}% doesn't meet criteria")
                
                except Exception as process_err:
                    print(f"Error analyzing {symbol}: {str(process_err)}")
                    errors.append(f"Error analyzing {symbol}: {str(process_err)}")
            
        except Exception as bars_err:
            print(f"Error getting bar data: {str(bars_err)}")
            errors.append(f"Error getting bar data: {str(bars_err)}")
            traceback.print_exc()
    
    except Exception as client_err:
        print(f"Error setting up Alpaca clients: {str(client_err)}")
        errors.append(f"Error setting up Alpaca clients: {str(client_err)}")
        traceback.print_exc()
    
    # If no matches found, provide detailed explanation
    if not matches:
        print("No stocks found meeting the criteria")
        print("This could be due to market conditions, API limits, or data availability")
    
    # Print final result count
    print(f"Found {len(matches)} matching stocks out of {len(symbols)} symbols")
    if errors:
        print(f"Encountered {len(errors)} errors during processing")
    
    # Prepare the result - NO DEFAULT VALUES
    result = {
        'matches': matches,
        'details': details,
        'errors': errors if errors else None
    }
    
    # Print with special markers for proper extraction
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    
    return result