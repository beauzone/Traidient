# Stock Screener Implementation Guide

This document provides essential guidelines for implementing stock screeners in our platform.

## The Issue with Screeners

We've identified that the stock screeners in our system face a critical issue:
- The Python code runs successfully (exit code 0)
- No error messages are displayed
- However, no stocks are returned in the results

This suggests that either:
1. The data being passed to the `screen_stocks` function is empty or invalid
2. The return format from the screener isn't being properly processed
3. There's an issue in how Python output is being captured

## Fixing the Stock Screener Module

Based on our testing, we recommend the following steps:

### Step 1: Server-Side Fixes

The server's Python execution service needs to be modified to ensure proper data handling. In `server/pythonExecutionService.ts`, we should:

1. Add detailed logging of what data is actually being passed to the screener
2. Ensure JSON parsing is properly handling stdout vs stderr
3. Modify how the script captures Python output

```typescript
// In runPythonScript function
pythonProcess.stdout.on('data', (data) => {
  const chunk = data.toString();
  console.log(`[Python stdout] ${chunk}`);
  outputData += chunk;
});

// Later, when parsing
try {
  // Look for the last valid JSON object in the output
  const jsonStartIdx = outputData.lastIndexOf('{');
  const jsonEndIdx = outputData.lastIndexOf('}') + 1;
  
  if (jsonStartIdx >= 0 && jsonEndIdx > jsonStartIdx) {
    const jsonStr = outputData.substring(jsonStartIdx, jsonEndIdx);
    const result = JSON.parse(jsonStr);
    resolve(result);
  } else {
    console.error('No valid JSON found in output');
    reject(new Error('No valid JSON found in output'));
  }
} catch (error) {
  // ...
}
```

### Step 2: Minimal Screener Template

For now, we recommend using the following extremely minimal screener template for testing:

```python
def screen_stocks(data_dict):
    """
    Minimal screener that should work with any system
    """
    # Always return these test stocks regardless of input
    return {
        'matches': [
            {"symbol": "TEST1", "price": 100.0},
            {"symbol": "TEST2", "price": 200.0}
        ],
        'details': {
            'total': 2
        }
    }
```

This simple screener will help verify if the system is correctly processing the return value.

### Step 3: Data Validation Utility

We should add a data validation utility to help diagnose issues:

```python
def validate_data(data_dict):
    """Test if data_dict is valid and contains expected data"""
    results = {
        "valid": False,
        "symbols_count": 0,
        "has_price_data": False,
        "sample_symbols": []
    }
    
    if data_dict is None:
        return results
    
    symbols = list(data_dict.keys())
    results["symbols_count"] = len(symbols)
    results["sample_symbols"] = symbols[:5] if symbols else []
    
    if symbols and data_dict[symbols[0]] is not None:
        df = data_dict[symbols[0]]
        if not df.empty and 'Close' in df.columns:
            results["has_price_data"] = True
            results["valid"] = True
    
    return results
```

## Long-Term Fix

For a complete fix, we should consider:

1. Improving error reporting in the Python execution service
2. Creating a robust test framework for screeners
3. Ensuring the data provider is correctly supplying data
4. Adding fallback data sources when primary ones fail

This will create a more reliable and maintainable screener system going forward.