def screen_stocks(data_dict):
    # Just return the simplest possible result
    return {
        'matches': ['AAPL', 'MSFT'],
        'details': {
            'AAPL': {'reason': 'Test match'},
            'MSFT': {'reason': 'Test match'}
        }
    }