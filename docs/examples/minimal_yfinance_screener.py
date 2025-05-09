import json
import yfinance as yf

def screen_stocks(data_dict):
    """
    Absolute minimal screener for testing
    Just gets AAPL price and checks if it's above 0
    """
    print("Running minimal YFinance screener")
    
    # Initialize
    matches = []
    details = {}
    errors = []
    
    try:
        # Get Apple stock data
        stock = yf.Ticker("AAPL")
        price = stock.history(period="1d")['Close'].iloc[-1]
        
        print(f"AAPL price: ${price:.2f}")
        
        # Most basic check possible
        if price > 0:
            matches.append("AAPL")
            details["AAPL"] = {
                "price": float(price),
                "reason": f"Price is ${price:.2f} which is above $0"
            }
    except Exception as e:
        error_msg = f"Error processing AAPL: {str(e)}"
        print(error_msg)
        errors.append(error_msg)
    
    # Prepare result
    result = {
        'matches': matches,
        'details': details,
        'errors': errors if errors else None
    }
    
    # CRITICAL: Must print with markers
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    
    return result