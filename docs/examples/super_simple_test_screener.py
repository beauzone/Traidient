def screen_stocks(data_dict):
    """
    Super simple test screener with absolute minimal code
    """
    # Just return a hardcoded match
    return {
        'matches': ['AAPL', 'MSFT'],
        'details': {
            'AAPL': {'reason': 'Test match'},
            'MSFT': {'reason': 'Test match'}
        }
    }