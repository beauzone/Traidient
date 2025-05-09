# Screener Troubleshooting Report

## Current Status

We've identified and fixed several fundamental issues with the Python screener execution system:

1. ✅ **Fixed the Python Output Buffering Issue**
   - Added `-u` flag to Python execution
   - Set `PYTHONUNBUFFERED=1` environment variable
   - Implemented `sys.stdout.flush()` in marker output code

2. ✅ **Improved Marker Detection**
   - Added regex-based extraction for `RESULT_JSON_START` and `RESULT_JSON_END` markers
   - More robust handling of different output formats

3. ✅ **Verified Basic Functionality**
   - Confirmed that simple test screeners work correctly
   - Successfully parsed JSON output and extracted matches

## Remaining Issues

Complex screeners like the SCTR Clone are still failing. Based on our investigation, there are two primary issues:

1. **Library Compatibility Issues**
   - The code expects `ta.trend.ppo` but should use `pandas_ta` with a different syntax
   - Error: `module 'ta.trend' has no attribute 'ppo'`

2. **Data Format Mismatches**
   - The screeners expect pandas DataFrames but are receiving dictionaries
   - Error: `'dict' object has no attribute 'empty'`

3. **Potential Library Installation Issues**
   - While pandas-ta is installed (confirmed in logs), complex indicators may not be available
   - Python environment might need additional configuration

## Recommended Solutions

1. **For Library Compatibility**:
   - Update screeners to use `import pandas_ta as ta` instead of `import ta`
   - Change indicator syntax to `df.ta.indicator()` instead of `ta.trend.indicator()`

2. **For Data Format Issues**:
   - Screeners should handle dictionaries by converting to DataFrames
   - Or modify the server to convert data to DataFrames before passing to screeners

3. **For Self-Contained Operation**:
   - Screeners should fetch their own data when needed using yfinance
   - This makes them independent of the data format passed in

## Next Steps

1. Implement a universal screener wrapper that:
   - Handles data format conversion
   - Provides consistent error handling
   - Ensures proper output formatting with markers and flushing

2. Update documentation for screener developers with:
   - Clear examples of working screeners
   - Guidance on which libraries and functions are available
   - Instructions for proper output formatting

3. Consider adding server-side preprocessing to:
   - Convert data to a format screeners expect
   - Pre-calculate common indicators
   - Reduce duplication of effort across screeners

## Technical Details

```python
# Correct way to initialize pandas-ta indicators
import pandas_ta as ta

# Then use with DataFrame syntax
df.ta.ema(length=200, append=True)  # Not ta.trend.ema()
df.ta.rsi(length=14, append=True)   # Not ta.momentum.rsi()
df.ta.ppo(append=True)              # Not ta.trend.ppo()

# Get indicator values from columns
ema_200 = df["EMA_200"]  # Note capitalization
rsi_14 = df["RSI_14"]    # Different naming convention
```

The critical issue is that pandas-ta uses a different API pattern and naming convention than what the complex screeners are expecting.