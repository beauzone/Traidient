import sys
import importlib.util
import subprocess

# Check Python version
print(f"Python version: {sys.version}")

# Check numpy
try:
    import numpy as np
    print(f"NumPy version: {np.__version__}")
    print(f"numpy.nan available: {hasattr(np, 'nan')}")
    print(f"Other NumPy constants: NaN: {hasattr(np, 'NaN')}, Inf: {hasattr(np, 'Inf')}")
except ImportError as e:
    print(f"NumPy import error: {e}")

# Check pandas
try:
    import pandas as pd
    print(f"Pandas version: {pd.__version__}")
except ImportError as e:
    print(f"Pandas import error: {e}")

# Check pandas_ta package location
try:
    pandas_ta_spec = importlib.util.find_spec("pandas_ta")
    if pandas_ta_spec:
        print(f"pandas_ta location: {pandas_ta_spec.origin}")
    else:
        print("pandas_ta module not found")
except Exception as e:
    print(f"Error finding pandas_ta: {e}")

# Try to import pandas_ta
try:
    import pandas_ta
    print(f"pandas_ta version: {pandas_ta.__version__}")
except ImportError as e:
    print(f"pandas_ta import error: {str(e)}")
    # Show traceback for more details
    import traceback
    traceback.print_exc()

# Check installed packages
try:
    result = subprocess.run([sys.executable, "-m", "pip", "list"], 
                          capture_output=True, text=True)
    print("\nInstalled packages:")
    packages = result.stdout.split('\n')
    for p in packages:
        if 'pandas' in p.lower() or 'numpy' in p.lower() or 'ta' in p.lower():
            print(p.strip())
except Exception as e:
    print(f"Error listing packages: {e}")