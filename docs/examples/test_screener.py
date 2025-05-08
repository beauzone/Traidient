def screen_stocks(data_dict):
    """
    Example screener function to test the Python execution service
    """
    print("Running test screener")
    
    # Simulate filtering stocks based on some criteria
    matches = ["AAPL", "MSFT"]
    details = {
        "AAPL": {"reason": "Above 200-day moving average"},
        "MSFT": {"reason": "Strong earnings momentum"}
    }
    
    print("Test screener completed successfully")
    
    return {
        'matches': matches,
        'details': details
    }