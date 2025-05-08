def screen_stocks(data_dict):
    """
    Super simple test screener with minimal dependencies
    """
    print("Running super simple test screener")
    
    # Just return a basic result
    matches = ["AAPL", "MSFT", "GOOGL"]
    
    print("Test completed successfully")
    
    return {
        'matches': matches,
        'details': {
            'test': 'This is a super simple test'
        }
    }