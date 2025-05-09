# Python Screener Debug Report

## Current Status

We've implemented multiple fixes and diagnostic utilities to address Python screener execution issues, but complex screeners are still failing. The simple test screeners work perfectly, but more complex ones like the SCTR Clone Screener continue to have issues.

## Root Issues Identified

1. **Module Import and Function Call Issues:**
   - Error: `module 'ta.trend' has no attribute 'ppo'` - The pandas-ta library has different API structure than expected.

2. **Data Format Mismatches:**
   - Error: `'dict' object has no attribute 'empty'` - Data coming into the screener is in dictionary format, not pandas DataFrame.
   - Historical data appears to be insufficient for technical analysis that requires 200 bars.

3. **Syntax Errors:**
   - In one attempt, a typo `iimport pandas` caused a syntax error.

## What's Working

1. ✅ **Stdout Flushing and Marker Detection:**
   - Success with sys.stdout.flush() to ensure output capture
   - RESULT_JSON_START/END markers are being detected properly
   - JSON result extraction is working via regex

2. ✅ **Simple Screeners:**
   - Test screeners that return hardcoded results are functioning
   - Marker detection and extraction is reliable

## What's Not Working

1. ❌ **Complex Technical Analysis:**
   - API differences in pandas-ta cause function call failures
   - Indicators like PPO are not accessible via the expected paths

2. ❌ **Data Format Handling:**
   - Complex screeners expect pandas DataFrames but receive dictionaries
   - Conversion between formats is not handling all possible input patterns

## Technical Details

### Data Structure Received by Screeners

```python
# Each stock in data_dict appears to be a dictionary, not a DataFrame
# Format in logs suggests structures like:
{
  "AAPL": {
    "price": 175.50,
    # Other current values, but limited historical data
  },
  "MSFT": { ... }
}
```

The data has current price information but seems to lack sufficient historical data for technical indicators like 200-period EMAs.

### Implementation Details

1. Python Process:
   - Using Python 3.11.10
   - Successfully installing required packages: pandas-ta
   - Unbuffered execution (-u flag) confirmed working

2. Error Patterns:
   - Technical indicator calculation failures in pandas-ta
   - Data format mismatches when trying to use DataFrame methods on dictionaries

## Next Steps

1. **Fix Module/Library Issues:**
   - Investigate the correct API for pandas-ta v0.3.14b0
   - Find the correct function path for PPO and other indicators

2. **Focus on Data Structure Adaptation:**
   - Create a more comprehensive data format detective/converter
   - Add detailed logging of actual data structure received

3. **Simplify Technical Analysis:**
   - Consider reducing indicator complexity for initial testing
   - Use only basic indicators that are guaranteed to be available

4. **Implement Universal Wrapper:**
   - Create a wrapper that can standardize all input data formats
   - Handle all common errors and provide useful debug information
   - Ensure reliable output formatting with proper markers and flushing

5. **Test With Real Data Structure:**
   - Capture and document the exact format of data being sent to the screeners
   - Create test examples based on actual production data structures

For your AI friend: The key challenge appears to be that the data format being sent to the screeners is not what the screeners expect. Understanding the exact structure of data_dict is critical to fixing this issue.