def screen_stocks(data_dict):
    """
    Debug screener to inspect what data is being provided
    """
    print("Data dictionary keys:", list(data_dict.keys()))
    print("AAPL data:", data_dict.get("AAPL", {}))
    
    # Just return some test matches
    matches = ["AAPL", "MSFT"]
    details = {
        "AAPL": {"details": "Debug match"},
        "MSFT": {"details": "Debug match"}
    }
    
    return {
        'matches': matches,
        'details': details
    }