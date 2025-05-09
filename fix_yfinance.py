#!/usr/bin/env python3
"""
Script to install and test yfinance installation
"""

import subprocess
import sys
import os

def main():
    print("Starting yfinance installation and testing script")
    
    # Step 1: Check Python version
    print(f"Python version: {sys.version}")
    print(f"Python executable: {sys.executable}")
    
    # Step 2: Install yfinance
    print("\nInstalling yfinance with pip:")
    try:
        # Force a reinstall to make sure we have the latest version
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "yfinance", "--upgrade", "--force-reinstall"],
            capture_output=True, 
            text=True
        )
        print(result.stdout)
        if result.stderr:
            print(f"Errors: {result.stderr}")
    except Exception as e:
        print(f"Error installing yfinance: {str(e)}")
    
    # Step 3: Verify installation
    print("\nVerifying yfinance installation:")
    try:
        import yfinance
        print(f"yfinance version: {yfinance.__version__}")
        print("Successfully imported yfinance")
    except ImportError:
        print("Failed to import yfinance")
        return
    
    # Step 4: Test functionality
    print("\nTesting yfinance functionality:")
    try:
        import yfinance as yf
        
        # Test Ticker API
        print("Testing Ticker API:")
        ticker = yf.Ticker("AAPL")
        fast_info = ticker.fast_info
        if hasattr(fast_info, 'last_price'):
            price = fast_info.last_price
        else:
            price = fast_info.previous_close
        print(f"AAPL price: {price}")
        
        # Test download API
        print("\nTesting download API:")
        data = yf.download("MSFT", period="1d")
        if not data.empty:
            print(f"MSFT closing price: {data['Close'].iloc[-1]}")
            print(f"Data columns: {data.columns.tolist()}")
            print(f"Data shape: {data.shape}")
        else:
            print("No data returned from download")
            
    except Exception as e:
        print(f"Error testing yfinance: {str(e)}")

if __name__ == "__main__":
    main()