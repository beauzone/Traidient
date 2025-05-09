# Python Screener Fixes

## Fixed Issues

### 1. pandas_ta Library Compatibility Fix
The main issue preventing complex screeners from working was a library compatibility problem:
- `numpy 2.2.4` doesn't have a `NaN` constant (only lowercase `nan`)
- `pandas_ta` was trying to import `from numpy import NaN as npNaN` which failed

**Solution:**
- Patched `pandas_ta` to use `nan` instead of `NaN`
- Modified `squeeze_pro.py` to fix the import
- Verified successful import after patch

### 2. Data Format Compatibility
Screeners were expecting pandas DataFrames but receiving dictionaries:
- Error: `'dict' object has no attribute 'empty'`
- Different format than what screeners expected

**Solution:**
- Added conversion logic to transform dictionary data to DataFrames
- Built fallback to fetch data directly if needed
- Made screeners resilient to different data formats

### 3. Technical Indicator API Usage
Screeners were using incorrect API patterns for technical indicators:
- Using `ta.trend.ppo()` but should use `df.ta.ppo()`
- Different function signatures and return types

**Solution:**
- Updated indicator calculations to use correct pandas_ta API
- Adjusted column references to match what pandas_ta produces
- Added error handling for missing indicators

## How To Use Fixed Screeners

### Data Format Inspector
Use `docs/examples/data_format_inspector.py` to see exactly what format data comes in:
- Shows actual data structure of what's passed to screeners
- Reports on presence of historical data
- Helps understand available fields

### Working SCTR Screener
The fixed SCTR screener in `docs/examples/real_sctr_screener.py`:
- Handles conversion from dictionaries to DataFrames
- Falls back to fetching data directly when needed
- Uses correct pandas_ta API patterns
- Follows proper output formatting with markers

### Simple Fallback Screener
For testing, use `docs/examples/working_sctr_screener.py`:
- Doesn't rely on external data or complex calculations
- Still demonstrates proper output format and flushing
- Useful as a template for new screeners

## Best Practices

1. **Always add stdout flushing:**
   ```python
   print("RESULT_JSON_START")
   print(json.dumps(result))
   print("RESULT_JSON_END")
   sys.stdout.flush()  # CRITICAL
   ```

2. **Handle multiple data formats:**
   - Check for both DataFrames and dictionaries
   - Convert dictionaries to DataFrames when needed
   - Fetch data directly when necessary

3. **Use correct pandas_ta syntax:**
   - `df.ta.indicator(length=X, append=True)` instead of `ta.category.indicator()`
   - Reference resulting columns properly (e.g., `EMA_200` not `ema_200`)

4. **Add proper error handling:**
   - Catch and log exceptions
   - Provide fallbacks for missing data
   - Skip stocks with insufficient history