import json
from datetime import datetime

def screen_stocks(data_dict):
    """
    Test function that outputs data specifically for the server execution format
    """
    # Create a minimal set of test matches
    matches = [
        {
            "symbol": "TEST",
            "price": 100.00,
            "details": "Test match for server compatibility"
        }
    ]
    
    # Return the expected format with 'matches' array
    return {
        "matches": matches,
        "details": {
            "screener_name": "Server Format Test",
            "total": len(matches)
        }
    }

# This simulates the structure that the server execution expects
if __name__ == "__main__":
    try:
        # Simulate running the screener
        result = {
            "success": True,
            "screener_id": 999,
            "matches": [
                {
                    "symbol": "TEST",
                    "price": 100.00,
                    "details": "Test match for server compatibility"
                }
            ],
            "details": {
                "screener_name": "Server Format Test",
                "total": 1
            },
            "execution_time": 0.5,
            "timestamp": datetime.now().isoformat()
        }
        
        # The server execution service captures this output
        print(json.dumps(result))
        
    except Exception as e:
        # Error format that the server expects
        error_result = {
            "success": False,
            "error": str(e),
            "matches": [],
            "details": {},
            "execution_time": 0,
            "timestamp": datetime.now().isoformat()
        }
        print(json.dumps(error_result))