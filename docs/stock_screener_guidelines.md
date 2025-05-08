# Guidelines for Creating Stock Screeners for Our Trading Platform

## Overview

This document outlines the requirements and structure for creating Python-based stock screeners that will integrate seamlessly with our trading platform's Screens module. Follow these guidelines carefully to ensure your screener functions properly within our system.

## Core Requirements

### 1. Structure and Entry Point

Every screener must:
- **Include a global `screen_stocks(data_dict)` function** that the platform will call
- Optionally use classes for organization, but the `screen_stocks` function must exist at the global level
- Handle input parameters and errors gracefully
- Return results in the specified JSON format with a 'matches' key

**IMPORTANT:** The platform specifically looks for a global function named `screen_stocks` that accepts a dictionary of symbols. This is the function that will be called by the system, not `run_screener`.

### 1.1 New Execution System

Our updated Python execution system now uses special markers to reliably extract results:
- Results are extracted from the output using `RESULT_JSON_START` and `RESULT_JSON_END` markers
- Any print statements or logging will be captured but won't interfere with result extraction
- The system properly handles errors and exceptions, wrapping them in the response
- All print statements are captured in the execution logs for debugging

### 2. Data Source

- Use **Yahoo Finance (yfinance)** as the primary data source
- Include proper error handling for API requests
- Minimize network requests where possible (batch requests when appropriate)
- Avoid using API keys in the screener code

### 3. Output Format

The `screen_stocks` function must return a dictionary with this structure:
```python
{
    'matches': [  # CRITICAL: The key must be 'matches', not 'results'
        "AAPL",              # List of matching stock ticker symbols
        "MSFT",
        "GOOGL"
    ],
    'details': {  # Dictionary with details for each matched stock
        "AAPL": {
            "price": 175.45,              # Optional: Current price as float
            "score": 85.7,                # Optional: Numerical score for ranking (higher is better)
            "rsi": 65.2,                  # Optional: Specific metrics relevant to your screener
            "details": "RSI: 65, P/E: 28" # Optional: Human-readable summary for display
        },
        "MSFT": {
            # Similar details structure
        }
    }
}
```

**IMPORTANT:** The new execution system will automatically wrap the return value in the special markers:
```
RESULT_JSON_START
{"matches": ["AAPL", "MSFT"], "details": {"AAPL": {"score": 85.7, "details": "RSI: 65"}}}
RESULT_JSON_END
```

For backward compatibility when testing outside the platform, you can still use the `run_screener` function which may return:
```python
{
    "results": [  # For standalone testing use 'results', but platform uses 'matches'
        {
            "symbol": "AAPL",
            "price": 175.45,
            "score": 85.7,
            "details": "RSI: 65, P/E: 28"
        }
    ],
    "metadata": {
        "total": 10,
        "screener_name": "RSI Divergence",
        "description": "Finds stocks with RSI divergence signals"
    }
}
```

## Code Template

```python
import pandas as pd
import numpy as np
import yfinance as yf
import ta  # Technical analysis library

class MyStockScreener:
    """
    [Insert detailed description of your screener here]
    """
    
    # Default parameters that can be customized when instantiating
    default_params = {
        "param1": 14,
        "param2": 30,
        # Add more as needed
    }
    
    def __init__(self, symbols=None, params=None):
        """Initialize the screener with optional custom parameters."""
        self.params = self.default_params.copy()
        if params:
            self.params.update(params)
            
        # Default symbols if none provided
        self.symbols = symbols or ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"]
    
    def process_data(self, data_dict):
        """Process each stock dataframe and identify matching stocks."""
        matches = []
        
        for symbol, df in data_dict.items():
            try:
                if df is None or df.empty or len(df) < 30:  # Need minimum data
                    continue
                
                # Calculate indicators (if not already in the dataframe)
                if "rsi" not in df.columns:
                    df["rsi"] = ta.momentum.rsi(df["Close"], window=self.params["param1"])
                
                # Get latest values
                latest = df.iloc[-1]
                
                # Apply screening criteria
                meets_criteria = latest["rsi"] > self.params["param2"]
                
                # If conditions met, add to results
                if meets_criteria:
                    matches.append({
                        "symbol": symbol,
                        "price": float(latest["Close"]),
                        "score": float(latest["rsi"]),
                        "details": "RSI: {}, Price: ${}".format(
                            round(latest["rsi"], 1), 
                            round(latest["Close"], 2)
                        )
                    })
            except Exception as e:
                print(f"Error processing {symbol}: {str(e)}")
                continue
        
        return matches
    
    # Add any helper methods needed for your screening logic


# THIS IS THE REQUIRED FUNCTION - the platform will call this
def screen_stocks(data_dict):
    """
    The platform calls this function with pre-loaded data.
    
    Args:
        data_dict: Dictionary mapping symbols to dataframes with OHLCV data
        
    Returns:
        Dictionary with 'matches' key containing the results
    """
    print(f"Running screen on {len(data_dict)} stocks")
    
    # Initialize screener with default parameters
    screener = MyStockScreener()
    
    # Process the data and get matches
    matches = screener.process_data(data_dict)
    
    print(f"Found {len(matches)} matching stocks")
    
    # Return in the format expected by the platform
    return {
        'matches': matches,
        'details': {
            'screener_name': 'My Stock Screener',
            'total': len(matches)
        }
    }


# For testing outside the platform
def run_screener(symbols=None, params=None):
    """Entry point function for standalone testing."""
    screener = MyStockScreener(symbols, params)
    
    # Download data for each symbol
    data_dict = {}
    for symbol in screener.symbols:
        try:
            df = yf.download(symbol, period="1mo", progress=False)
            if not df.empty:
                data_dict[symbol] = df
        except Exception as e:
            print(f"Error downloading {symbol}: {str(e)}")
    
    # Use the screen_stocks function to process the data
    results = screen_stocks(data_dict)
    
    # Convert to the standalone format
    return {
        "results": results['matches'],
        "metadata": {
            "total": len(results['matches']),
            "screener_name": "My Stock Screener",
            "description": "Description of the strategy"
        }
    }
```

## Best Practices

1. **Error Handling**
   - Wrap data fetching in try/except blocks
   - Handle missing data points gracefully
   - Never let a single stock failure crash the entire screener

2. **Performance**
   - Process each stock efficiently
   - Use vectorized operations with pandas/numpy when possible
   - Avoid unnecessarily large date ranges (1-2 years is typically sufficient)

3. **Customization**
   - Make all screening parameters configurable
   - Provide sensible defaults
   - Document parameter meanings

4. **Documentation**
   - Include detailed docstrings explaining the screening method
   - Comment complex calculations
   - Explain the logic behind scoring metrics

5. **Data Fetching**
   - Use `progress=False` with yfinance to suppress download bars
   - Consider chunking large symbol lists
   - Implement caching if appropriate

## Example Implementation

Below is a complete working example with the correct platform integration:

```python
import yfinance as yf
import pandas as pd
import numpy as np
import ta

class RSIOverboughtScreener:
    """
    Screens for stocks with RSI > 70 (potentially overbought).
    """
    
    default_params = {
        "rsi_period": 14,
        "rsi_threshold": 70
    }
    
    def __init__(self, symbols=None, params=None):
        self.params = self.default_params.copy()
        if params:
            self.params.update(params)
        self.symbols = symbols or ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"]
    
    def process_dataframes(self, data_dict):
        """Process the provided dataframes and return matching stocks."""
        matches = []
        
        for symbol, df in data_dict.items():
            try:
                if df is None or df.empty:
                    continue
                
                # Calculate RSI if not already present
                if "rsi" not in df.columns:
                    df["rsi"] = ta.momentum.rsi(df["Close"], window=self.params["rsi_period"])
                
                # Get latest values
                latest = df.iloc[-1]
                rsi = latest["rsi"]
                
                # Check if RSI is above threshold
                if rsi > self.params["rsi_threshold"]:
                    matches.append({
                        "symbol": symbol,
                        "price": float(latest["Close"]),
                        "score": float(rsi),
                        "details": "RSI: {}, Price: ${}".format(
                            round(rsi, 1), 
                            round(latest["Close"], 2)
                        )
                    })
            except Exception as e:
                print(f"Error processing {symbol}: {str(e)}")
                continue
        
        return matches


# THIS IS THE REQUIRED FUNCTION FOR THE PLATFORM
def screen_stocks(data_dict):
    """
    Screen stocks based on RSI being above the threshold.
    This function is what the platform will call with preloaded data.
    
    Args:
        data_dict: Dictionary of {symbol: dataframe} pairs
        
    Returns:
        Dictionary with 'matches' key containing the results
    """
    print(f"Running RSI Overbought screen on {len(data_dict)} stocks")
    
    # Create screener instance
    screener = RSIOverboughtScreener()
    
    # Process the data
    matches = screener.process_dataframes(data_dict)
    
    print(f"Found {len(matches)} stocks with overbought RSI")
    
    # Return in the format expected by the platform
    return {
        'matches': matches,
        'details': {
            'screener_name': 'RSI Overbought',
            'total': len(matches)
        }
    }


# For standalone testing
def run_screener(symbols=None, params=None):
    """Entry point function for testing outside the platform."""
    screener = RSIOverboughtScreener(symbols, params)
    
    # Fetch data for each symbol
    data_dict = {}
    for symbol in screener.symbols:
        try:
            df = yf.download(symbol, period="1mo", progress=False)
            if not df.empty:
                data_dict[symbol] = df
        except Exception as e:
            print(f"Error downloading {symbol}: {str(e)}")
    
    # Use the same screen_stocks function the platform will call
    results = screen_stocks(data_dict)
    
    # Return in the standard format for API responses
    return {
        "results": results['matches'],
        "metadata": {
            "total": len(results['matches']),
            "screener_name": "RSI Overbought",
            "description": "Stocks with RSI > 70, potentially overbought"
        }
    }
```

## Additional Tips

1. **Available Libraries**
   - yfinance for market data
   - pandas, numpy for data manipulation
   - ta for technical indicators
   - pandas-ta for additional technical indicators
   - scipy for statistical functions
   - matplotlib/mplfinance (avoid for screeners, used for visualization only)

2. **Symbol Universe**
   - Always allow the user to provide their own symbol list
   - Provide a reasonable default list for testing
   - The platform will provide the appropriate universe when called

3. **Processing Time**
   - Screeners should complete within a reasonable time frame
   - Consider optimizing computationally intensive operations
   - Add progress indicators for lengthy operations

4. **Testing**
   - Test with both small and large symbol universes
   - Verify your screener can handle symbols with limited data
   - Ensure your parameters can be adjusted without breaking the screener

This document should be used in conjunction with the platform's API documentation and Python environment specifications.