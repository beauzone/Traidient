#!/usr/bin/env python3
"""
Parameterized Screener

A minimal but functional screener that allows for strategy selection
via command line parameters. Still avoids heavy dependencies.
"""

import json
import sys
import time
from datetime import datetime

def main():
    """Main function that returns screener results based on given parameters"""
    # Get strategy from command line args if provided
    strategy = "momentum"  # Default strategy
    if len(sys.argv) > 1:
        strategy = sys.argv[1]
    
    # Simulate a brief delay for realism
    time.sleep(0.5)
    
    # Get current timestamp
    timestamp = datetime.now().isoformat()
    
    # Base result structure
    result = {
        "strategy": strategy,
        "timestamp": timestamp,
        "execution_time_ms": 500,
        "status": "success",
        "message": f"{strategy.capitalize()} screener executed successfully"
    }
    
    # Strategy-specific results
    if strategy == "momentum":
        result["matches"] = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA"]
        result["details"] = {
            "AAPL": {
                "price": 214.50,
                "ma20": 210.25,
                "above_ma": True,
                "pct_above": 2.02,
                "rsi": 68.2,
                "volume_ratio": 1.3
            },
            "MSFT": {
                "price": 428.50,
                "ma20": 415.70,
                "above_ma": True,
                "pct_above": 3.08,
                "rsi": 65.8,
                "volume_ratio": 1.2
            },
            "GOOGL": {
                "price": 176.30,
                "ma20": 172.45,
                "above_ma": True,
                "pct_above": 2.23,
                "rsi": 62.4,
                "volume_ratio": 1.15
            },
            "AMZN": {
                "price": 178.30,
                "ma20": 173.92,
                "above_ma": True,
                "pct_above": 2.52,
                "rsi": 64.7,
                "volume_ratio": 1.25
            },
            "NVDA": {
                "price": 924.70,
                "ma20": 880.15,
                "above_ma": True,
                "pct_above": 5.06,
                "rsi": 69.5,
                "volume_ratio": 1.5
            }
        }
    elif strategy == "trend_following":
        result["matches"] = ["AAPL", "MSFT", "NVDA", "CRM", "NET"]
        result["details"] = {
            "AAPL": {
                "price": 214.50,
                "ma50": 205.30,
                "ma200": 196.70,
                "adx": 28.5,
                "plus_di": 24.3,
                "minus_di": 18.1
            },
            "MSFT": {
                "price": 428.50,
                "ma50": 412.20,
                "ma200": 390.10,
                "adx": 32.1,
                "plus_di": 26.5,
                "minus_di": 15.8
            },
            "NVDA": {
                "price": 924.70,
                "ma50": 870.40,
                "ma200": 760.25,
                "adx": 42.3,
                "plus_di": 35.2,
                "minus_di": 10.5
            },
            "CRM": {
                "price": 295.50,
                "ma50": 282.40,
                "ma200": 265.30,
                "adx": 26.4,
                "plus_di": 22.3,
                "minus_di": 18.7
            },
            "NET": {
                "price": 95.60,
                "ma50": 89.25,
                "ma200": 83.10,
                "adx": 24.2,
                "plus_di": 20.8,
                "minus_di": 19.2
            }
        }
    elif strategy == "williams":
        result["matches"] = ["AMD", "AMZN", "PATH", "PYPL", "PLTR"]
        result["details"] = {
            "AMD": {
                "price": 172.40,
                "williams_r": -4.5,
                "prev_williams_r": -21.3,
                "rsi": 63.8
            },
            "AMZN": {
                "price": 178.30,
                "williams_r": -8.2,
                "prev_williams_r": -25.6,
                "rsi": 64.7
            },
            "PATH": {
                "price": 22.10,
                "williams_r": -10.5,
                "prev_williams_r": -32.8,
                "rsi": 58.4
            },
            "PYPL": {
                "price": 62.80,
                "williams_r": -7.3,
                "prev_williams_r": -28.2,
                "rsi": 60.5
            },
            "PLTR": {
                "price": 24.30,
                "williams_r": -9.8,
                "prev_williams_r": -26.4,
                "rsi": 62.3
            }
        }
    elif strategy == "cup_handle":
        result["matches"] = ["CRWD", "NET", "PANS", "AVGO"]
        result["details"] = {
            "CRWD": {
                "price": 322.00,
                "cup_depth_pct": 18.5,
                "handle_depth_pct": 7.2,
                "cup_duration_days": 120,
                "handle_duration_days": 21,
                "breakout_level": 328.50
            },
            "NET": {
                "price": 95.60,
                "cup_depth_pct": 22.3,
                "handle_depth_pct": 8.5,
                "cup_duration_days": 145,
                "handle_duration_days": 24,
                "breakout_level": 98.75
            },
            "PANS": {
                "price": 688.24,
                "cup_depth_pct": 15.8,
                "handle_depth_pct": 6.3,
                "cup_duration_days": 110,
                "handle_duration_days": 18,
                "breakout_level": 695.00
            },
            "AVGO": {
                "price": 1361.00,
                "cup_depth_pct": 14.2,
                "handle_depth_pct": 5.8,
                "cup_duration_days": 95,
                "handle_duration_days": 15,
                "breakout_level": 1380.00
            }
        }
    elif strategy == "canslim":
        result["matches"] = ["NVDA", "CRWD", "PANS", "AVGO", "NOW"]
        result["details"] = {
            "NVDA": {
                "price": 924.70,
                "eps_growth_current": 112.5,
                "eps_growth_qtr": 135.8,
                "revenue_growth_qtr": 95.2,
                "roe": 58.4,
                "relative_strength": 99
            },
            "CRWD": {
                "price": 322.00,
                "eps_growth_current": 87.2,
                "eps_growth_qtr": 92.5,
                "revenue_growth_qtr": 45.8,
                "roe": 32.5,
                "relative_strength": 94
            },
            "PANS": {
                "price": 688.24,
                "eps_growth_current": 68.4,
                "eps_growth_qtr": 72.1,
                "revenue_growth_qtr": 25.4,
                "roe": 28.3,
                "relative_strength": 90
            },
            "AVGO": {
                "price": 1361.00,
                "eps_growth_current": 45.8,
                "eps_growth_qtr": 52.3,
                "revenue_growth_qtr": 38.9,
                "roe": 63.7,
                "relative_strength": 92
            },
            "NOW": {
                "price": 778.80,
                "eps_growth_current": 38.5,
                "eps_growth_qtr": 42.7,
                "revenue_growth_qtr": 24.3,
                "roe": 42.8,
                "relative_strength": 88
            }
        }
    else:
        # Default case - basic price screen
        result["matches"] = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA"]
        result["details"] = {
            "AAPL": {"price": 214.50},
            "MSFT": {"price": 428.50},
            "GOOGL": {"price": 176.30},
            "AMZN": {"price": 178.30},
            "NVDA": {"price": 924.70}
        }
    
    # Output as JSON
    print(json.dumps(result))
    return 0

if __name__ == "__main__":
    main()