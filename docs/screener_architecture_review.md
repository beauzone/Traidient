# Stock Screener Architecture: Review & Improvements

This document outlines the diagnostic investigation, issue identification, and improvements made to the Python screener implementation.

## Root Cause Identification

The core issue with screeners was related to **output buffering in Python processes**, causing Node.js to miss the results that were printed to stdout. Specifically:

1. Python's stdout is buffered by default
2. Small outputs might not be flushed before the process exits
3. Node.js was unable to capture the marker-wrapped JSON results
4. The screener appeared to run but returned no matches

## Key Fixes Implemented

### 1. Python Process Execution Improvements

- Added `-u` flag to Python execution (unbuffered mode)
- Set environment variables to disable buffering:
  ```typescript
  env: {
    ...process.env,
    PYTHONUNBUFFERED: '1',
    PYTHONIOENCODING: 'utf-8'
  }
  ```

### 2. Explicit Output Flushing in Screeners

Added mandatory `sys.stdout.flush()` after printing markers:

```python
print("RESULT_JSON_START")
print(json.dumps(result))
print("RESULT_JSON_END")
sys.stdout.flush()  # CRUCIAL: ensures output is captured before process exits
```

### 3. Enhanced Result Extraction in Node.js

- Added regex-based extraction as a primary method
- Improved traditional marker-based extraction as fallback
- Better logging for troubleshooting and diagnostics

### 4. Comprehensive Error Handling

- Proper error capture and reporting with marker-based JSON output
- Standardized error format (errors field in JSON)
- Consistent stdout flushing with errors too

## Best Practices for Screener Development

1. **Always include stdout flushing**
   - Import sys and call sys.stdout.flush() after printing markers
   - This guarantees output capture regardless of buffering settings

2. **Use the universal wrapper when possible**
   - The wrapper handles marker formatting and flushing automatically
   - Simplifies screener development by handling boilerplate code

3. **Follow standardized result format**
   - matches: Array of symbol strings
   - details: Object with details for each match
   - errors: Error message if any

4. **Proper error handling**
   - Wrap screener code in try/except
   - Return error information in the standard format
   - Ensure markers and flushing in error cases too

## Testing & Verification

A minimal test case was created to validate the solution:

```python
import json
import sys

def screen_stocks(data_dict):
    """
    Minimal test screener that always returns a hardcoded match.
    Uses stdout flushing to ensure proper capture.
    """
    result = {
        "matches": ["AAPL", "MSFT", "GOOG"],
        "details": {
            "AAPL": {"price": 190.25, "reason": "Test match"},
            "MSFT": {"price": 415.78, "reason": "Test match"},
            "GOOG": {"price": 180.45, "reason": "Test match"}
        },
        "errors": None
    }
    
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    sys.stdout.flush()
    
    return result
```

## Lessons Learned

1. Process execution and stdio handling are critical for reliable IPC
2. Always handle buffering explicitly when capturing child process output
3. Provide robust and flexible extraction methods with multiple fallbacks
4. Python's default buffering behavior can cause subtle issues in Node.js integration