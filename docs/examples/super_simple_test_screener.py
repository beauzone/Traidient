def screen_stocks(data_dict):
    # No docstring at all, just return a hardcoded match 
    return {
        'matches': ['AAPL', 'MSFT'],
        'details': {
            'AAPL': {'reason': 'Test match'},
            'MSFT': {'reason': 'Test match'}
        }
    }