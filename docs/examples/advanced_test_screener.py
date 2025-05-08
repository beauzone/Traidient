def screen_stocks(data_dict):
    """
    A slightly more advanced test screener that simulates calculating technical indicators
    """
    print("Running advanced test screener")
    
    # Simulating some technical analysis
    screened_stocks = []
    details = {}
    
    for symbol in data_dict:
        # For testing purposes, we'll use a simple rule:
        # Include AAPL and MSFT, exclude GOOGL based on simulated metrics
        if symbol == "AAPL":
            screened_stocks.append(symbol)
            details[symbol] = {
                "reason": "RSI below 30 (oversold)",
                "metrics": {
                    "rsi": 28.5,
                    "macd": -0.5,
                    "volume_change": 1.2
                }
            }
        elif symbol == "MSFT":
            screened_stocks.append(symbol)
            details[symbol] = {
                "reason": "Golden cross (50 SMA crossed above 200 SMA)",
                "metrics": {
                    "sma_50": 310.25,
                    "sma_200": 295.30,
                    "volume_change": 1.5
                }
            }
        elif symbol == "AMZN":
            screened_stocks.append(symbol)
            details[symbol] = {
                "reason": "Bullish MACD crossover",
                "metrics": {
                    "macd": 2.5,
                    "macd_signal": 1.8,
                    "histogram": 0.7
                }
            }
    
    print(f"Advanced test screener completed successfully: found {len(screened_stocks)} matches")
    
    # Return the screened stocks and details
    return {
        'matches': screened_stocks,
        'details': details
    }