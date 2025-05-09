import os
import re

# Find the problematic file
squeeze_pro_path = os.path.join(os.path.expanduser('~'), 'workspace', '.pythonlibs', 'lib', 'python3.11', 'site-packages', 'pandas_ta', 'momentum', 'squeeze_pro.py')

if os.path.exists(squeeze_pro_path):
    print(f"Found file to patch: {squeeze_pro_path}")
    
    # Read the file
    with open(squeeze_pro_path, 'r') as f:
        content = f.read()
    
    # Replace 'from numpy import NaN as npNaN' with 'from numpy import nan as npNaN'
    patched_content = content.replace('from numpy import NaN as npNaN', 'from numpy import nan as npNaN')
    
    # Write the patched file
    with open(squeeze_pro_path, 'w') as f:
        f.write(patched_content)
    
    print("Successfully patched squeeze_pro.py")
else:
    print(f"File not found: {squeeze_pro_path}")
    
    # Search for the file
    for root, dirs, files in os.walk(os.path.join(os.path.expanduser('~'), 'workspace', '.pythonlibs')):
        if 'squeeze_pro.py' in files:
            file_path = os.path.join(root, 'squeeze_pro.py')
            print(f"Found squeeze_pro.py at: {file_path}")
            
            # Read the file
            with open(file_path, 'r') as f:
                content = f.read()
            
            # Replace 'from numpy import NaN as npNaN' with 'from numpy import nan as npNaN'
            patched_content = content.replace('from numpy import NaN as npNaN', 'from numpy import nan as npNaN')
            
            # Write the patched file
            with open(file_path, 'w') as f:
                f.write(patched_content)
            
            print("Successfully patched squeeze_pro.py")
            break
    else:
        print("Could not find squeeze_pro.py anywhere in .pythonlibs")

# Verify the fix worked
print("\nTrying to import pandas_ta after patch:")
try:
    import pandas_ta
    print(f"pandas_ta successfully imported! Version: {pandas_ta.__version__}")
except ImportError as e:
    print(f"Import still failing: {e}")
    import traceback
    traceback.print_exc()