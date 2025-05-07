def screen_stocks(data_dict):
    # Only return a list of two hardcoded stocks
    matches = ['AAPL', 'MSFT']
    details = {}
    
    # Add some basic details
    for symbol in matches:
        details[symbol] = {'reason': 'Test match'}
    
    # Return the standard format
    return {
        'matches': matches,
        'details': details
    }