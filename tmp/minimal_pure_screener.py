#!/usr/bin/env python3
"""
Minimal Pure Screener

This is a completely minimal screener focused on returning static data for testing.
It avoids all technical indicator calculations and external dependencies.

Simply returns a predefined list of stocks with dummy data.
"""

import json
import time
from datetime import datetime

def main():
    """Main function that returns a static list of stocks for testing"""
    # Simulate a brief delay for realism
    time.sleep(0.5)
    
    # Get current timestamp
    timestamp = datetime.now().isoformat()
    
    # Create a static result that doesn't require any calculations
    result = {
        "matches": ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA"],
        "details": {
            "AAPL": {
                "price": 214.50,
                "ma20": 210.25,
                "above_ma": True,
                "pct_above": 2.02
            },
            "MSFT": {
                "price": 428.50,
                "ma20": 415.70,
                "above_ma": True,
                "pct_above": 3.08
            },
            "GOOGL": {
                "price": 176.30,
                "ma20": 172.45,
                "above_ma": True,
                "pct_above": 2.23
            },
            "AMZN": {
                "price": 178.30,
                "ma20": 173.92,
                "above_ma": True,
                "pct_above": 2.52
            },
            "NVDA": {
                "price": 924.70,
                "ma20": 880.15,
                "above_ma": True,
                "pct_above": 5.06
            }
        },
        "timestamp": timestamp,
        "execution_time_ms": 500,
        "status": "success",
        "message": "Pure screener executed successfully"
    }
    
    # Output as JSON
    print(json.dumps(result))
    return 0

if __name__ == "__main__":
    main()